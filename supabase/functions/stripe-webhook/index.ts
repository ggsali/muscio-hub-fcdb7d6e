import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
  const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

  if (!STRIPE_SECRET_KEY) {
    return new Response("STRIPE_SECRET_KEY not configured", { status: 500 });
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-08-27.basil" });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    let event: Stripe.Event;

    if (STRIPE_WEBHOOK_SECRET && signature) {
      // Verify signature in production
      try {
        event = await stripe.webhooks.constructEventAsync(
          body,
          signature,
          STRIPE_WEBHOOK_SECRET,
          undefined,
          Stripe.createSubtleCryptoProvider()
        );
      } catch (err) {
        console.error("Webhook signature verification failed:", err);
        return new Response("Invalid signature", { status: 400 });
      }
    } else {
      // No webhook secret configured – parse directly (dev/test mode)
      event = JSON.parse(body) as Stripe.Event;
    }

    console.log(`[stripe-webhook] Event: ${event.type}`);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.order_id;
      const amountTotal = session.amount_total; // in Rappen

      console.log(`[stripe-webhook] Payment completed for orderId=${orderId}, amount=${amountTotal}`);

      if (!orderId) {
        console.error("[stripe-webhook] No order_id in session metadata");
        return new Response(JSON.stringify({ received: true, warning: "No order_id in metadata" }), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      }

      // 1. Mark all unpaid bills for this order as paid
      const today = new Date().toISOString().split("T")[0];
      await supabase
        .from("bills" as any)
        .update({ bezahlt: true, bezahlt_am: today })
        .eq("order_id", orderId)
        .eq("bezahlt", false);

      // 2. Update order status to "Bezahlt"
      await supabase
        .from("orders")
        .update({ status: "Bezahlt" })
        .eq("id", orderId);

      // 3. Log status change
      await supabase.from("order_status_log").insert({
        order_id: orderId,
        status: "Bezahlt",
        notiz: `Online-Zahlung via Stripe (CHF ${((amountTotal || 0) / 100).toFixed(2)})`,
      });

      // 4. Send payment confirmation email
      if (RESEND_API_KEY) {
        try {
          const { data: order } = await supabase
            .from("orders")
            .select("*, customers(*)")
            .eq("id", orderId)
            .single();

          const { data: companySettingsData } = await supabase
            .from("company_settings")
            .select("*");
          const getSetting = (key: string) => companySettingsData?.find((s: any) => s.key === key)?.value ?? "";
          const companyName = getSetting("firmenname") || "3dMuscio";

          if (order && (order as any).customers?.email) {
            const customer = (order as any).customers;
            const customerName = [customer.vorname, customer.name].filter(Boolean).join(" ") || customer.name;
            const orderNr = orderId.slice(0, 8).toUpperCase();
            const orderName = (order as any).name || (order as any).beschreibung || `Auftrag ${orderNr}`;
            const amountFormatted = `CHF ${((amountTotal || 0) / 100).toFixed(2)}`;

            const emailFooter = `
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 16px;" />
              <div style="text-align:center;">
                <p style="margin:0;font-size:12px;color:#9ca3af;">
                  <a href="mailto:info@3dmuscio.com" style="color:#ea580c;text-decoration:none;">info@3dmuscio.com</a>
                  &nbsp;·&nbsp;
                  <span>+41 79 839 50 80</span>
                  &nbsp;·&nbsp;
                  <a href="https://www.3dmuscio.com" style="color:#ea580c;text-decoration:none;">www.3dmuscio.com</a>
                </p>
              </div>`;

            const htmlBody = `
              <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
                <div style="background:#18181b;padding:24px 32px;border-radius:8px 8px 0 0;">
                  <h1 style="color:#ffffff;margin:0;font-size:22px;">${companyName}</h1>
                </div>
                <div style="background:#ffffff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
                  <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:16px 20px;margin-bottom:24px;display:flex;align-items:center;gap:12px;">
                    <span style="font-size:28px;">✅</span>
                    <div>
                      <p style="margin:0;font-size:15px;font-weight:700;color:#16a34a;">Zahlung erfolgreich eingegangen!</p>
                      <p style="margin:4px 0 0;font-size:12px;color:#6b7280;">Auftrag Nr. ${orderNr}</p>
                    </div>
                  </div>
                  <p>Guten Tag ${customerName},</p>
                  <p>vielen Dank! Ihre Zahlung für den Auftrag <strong>„${orderName}"</strong> wurde erfolgreich verarbeitet.</p>
                  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin:20px 0;">
                    <p style="margin:0 0 4px;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Bezahlter Betrag</p>
                    <p style="margin:0;font-size:24px;font-weight:700;color:#16a34a;">${amountFormatted}</p>
                  </div>
                  <p style="color:#6b7280;font-size:13px;">Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>
                  <p>Mit freundlichen Grüssen<br><strong>${companyName}</strong></p>
                  ${emailFooter}
                </div>
              </div>`;

            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${RESEND_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: `${companyName} <info@3dmuscio.com>`,
                to: [customer.email],
                subject: `Zahlungsbestätigung – ${orderName} | ${companyName}`,
                html: htmlBody,
              }),
            });

            console.log(`[stripe-webhook] Confirmation email sent to ${customer.email}`);
          }
        } catch (emailErr) {
          console.error("[stripe-webhook] Email sending failed:", emailErr);
          // Don't fail the webhook because of email error
        }
      }

      return new Response(JSON.stringify({ received: true, orderId }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[stripe-webhook] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
