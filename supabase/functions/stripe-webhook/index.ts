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

      // Admin notification for shop orders
      try {
        const shopOrderId = session.metadata?.shop_order_id;
        if (shopOrderId) {
          const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);
          const { data: shopOrder } = await supabase
            .from("shop_orders")
            .select("*, shop_order_items(*, shop_products(name))")
            .eq("id", shopOrderId)
            .single();

          if (shopOrder) {
            const itemsHtml = (shopOrder.shop_order_items || [])
              .map((item: any) => `
                <tr>
                  <td style="padding:8px;border-bottom:1px solid #f0f0f0;">${item.shop_products?.name || "–"}</td>
                  <td style="padding:8px;border-bottom:1px solid #f0f0f0;text-align:center;">${item.quantity}×</td>
                  <td style="padding:8px;border-bottom:1px solid #f0f0f0;text-align:right;">CHF ${Number(item.unit_price || 0).toFixed(2)}</td>
                </tr>
              `).join("");

            await resend.emails.send({
              from: "3DMuscio <noreply@3dmuscio.com>",
              to: ["info@3dmuscio.com"],
              subject: `🛍️ Neue Shop-Bestellung – CHF ${Number(shopOrder.total || 0).toFixed(2)}`,
              html: `
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111;">
                  <h1 style="color:#FF5A00;">🛍️ Neue Shop-Bestellung</h1>
                  <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                    <thead>
                      <tr style="background:#f8f8f8;">
                        <th style="padding:8px;text-align:left;">Produkt</th>
                        <th style="padding:8px;text-align:center;">Menge</th>
                        <th style="padding:8px;text-align:right;">Preis</th>
                      </tr>
                    </thead>
                    <tbody>${itemsHtml}</tbody>
                  </table>
                  <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                    <tr>
                      <td style="padding:8px;">Zwischensumme</td>
                      <td style="padding:8px;text-align:right;">CHF ${Number(shopOrder.subtotal || 0).toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td style="padding:8px;">Versand</td>
                      <td style="padding:8px;text-align:right;">CHF ${Number(shopOrder.shipping || 0).toFixed(2)}</td>
                    </tr>
                    <tr style="font-weight:bold;">
                      <td style="padding:8px;">Total</td>
                      <td style="padding:8px;text-align:right;">CHF ${Number(shopOrder.total || 0).toFixed(2)}</td>
                    </tr>
                  </table>
                  <p><strong>Kunde:</strong> ${shopOrder.customer_name || "–"}</p>
                  <p><strong>E-Mail:</strong> ${shopOrder.customer_email || "–"}</p>
                  <p><strong>Lieferadresse:</strong> ${shopOrder.shipping_address || "–"}, ${shopOrder.shipping_postal_code || ""} ${shopOrder.shipping_city || ""}</p>
                  <p style="margin-top:24px;">
                    <a href="https://muscio-hub.lovable.app/admin/website-bestellungen" style="background:#FF5A00;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px;">Bestellung im Admin anzeigen →</a>
                  </p>
                </div>
              `,
            });
            console.log(`[stripe-webhook] admin notification sent for shop order ${shopOrderId}`);
          }
        }
      } catch (notifyErr) {
        console.error("[stripe-webhook] admin notification error:", notifyErr);
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
