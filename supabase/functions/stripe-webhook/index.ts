import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { Resend } from "npm:resend@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
  const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!STRIPE_SECRET_KEY) {
    console.error("[stripe-webhook] STRIPE_SECRET_KEY missing");
    return new Response("STRIPE_SECRET_KEY missing", { status: 500 });
  }
  if (!STRIPE_WEBHOOK_SECRET) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET missing");
    return new Response("STRIPE_WEBHOOK_SECRET missing", { status: 500 });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[stripe-webhook] Supabase env missing");
    return new Response("Supabase env missing", { status: 500 });
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-08-27.basil" });
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    console.error("[stripe-webhook] Missing stripe-signature header");
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      STRIPE_WEBHOOK_SECRET,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch (err) {
    console.error("[stripe-webhook] Signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  console.log(`[stripe-webhook] ✅ Event received: type=${event.type} id=${event.id}`);

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.order_id;
      const amountTotal = session.amount_total ?? 0;
      const amountChf = amountTotal / 100;

      console.log(`[stripe-webhook] checkout.session.completed: orderId=${orderId} amount=CHF ${amountChf.toFixed(2)} sessionId=${session.id}`);

      if (!orderId) {
        console.warn("[stripe-webhook] No order_id in session metadata — skipping DB update");
        return new Response(JSON.stringify({ received: true, warning: "no_order_id" }), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      }

      const today = new Date().toISOString().split("T")[0];

      const { error: billsErr, count: billsCount } = await supabase
        .from("bills" as any)
        .update({ bezahlt: true, bezahlt_am: today }, { count: "exact" })
        .eq("order_id", orderId)
        .eq("bezahlt", false);
      if (billsErr) console.error("[stripe-webhook] bills update error:", billsErr);
      else console.log(`[stripe-webhook] bills marked paid: ${billsCount ?? 0}`);

      const { error: orderErr } = await supabase
        .from("orders")
        .update({ status: "Bezahlt" })
        .eq("id", orderId);
      if (orderErr) console.error("[stripe-webhook] orders update error:", orderErr);
      else console.log(`[stripe-webhook] order ${orderId} status -> Bezahlt`);

      const { error: logErr } = await supabase.from("order_status_log").insert({
        order_id: orderId,
        status: "Bezahlt",
        notiz: `Online-Zahlung via Stripe (CHF ${amountChf.toFixed(2)})`,
      });
      if (logErr) console.error("[stripe-webhook] status log error:", logErr);

      // Confirmation email via send-transactional-email
      try {
        const { data: order, error: orderFetchErr } = await supabase
          .from("orders")
          .select("*, customers(*)")
          .eq("id", orderId)
          .single();

        if (orderFetchErr || !order) {
          console.error("[stripe-webhook] order fetch failed:", orderFetchErr);
        } else {
          const customer = (order as any).customers;
          if (!customer?.email) {
            console.warn("[stripe-webhook] customer email missing — skipping confirmation email");
          } else {
            const customerName = [customer.vorname, customer.name].filter(Boolean).join(" ") || customer.name || "";
            const orderNr = orderId.slice(0, 8).toUpperCase();
            const orderName = (order as any).name || (order as any).beschreibung || `Auftrag ${orderNr}`;
            const amountFormatted = `CHF ${amountChf.toFixed(2)}`;

            const { error: mailErr } = await supabase.functions.invoke("send-transactional-email", {
              body: {
                templateName: "zahlung-bestaetigung",
                recipientEmail: customer.email,
                idempotencyKey: `payment-confirmation-${session.id}`,
                templateData: { customerName, orderName, orderNr, amountFormatted },
              },
            });
            if (mailErr) console.error("[stripe-webhook] confirmation email failed:", mailErr);
            else console.log(`[stripe-webhook] confirmation email queued for ${customer.email}`);
          }
        }
      } catch (emailErr) {
        console.error("[stripe-webhook] confirmation email exception:", emailErr);
      }

      return new Response(JSON.stringify({ received: true, orderId }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    // Always return 200 so Stripe doesn't retry endlessly; the error is fully logged.
    console.error("[stripe-webhook] handler error (returning 200 to avoid retry storm):", err);
    return new Response(JSON.stringify({ received: true, error: String(err) }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }
});
