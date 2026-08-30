import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.0.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FROM_EMAIL = "3DMuscio <noreply@3dmuscio.com>";
const REPLY_TO = "info@3dmuscio.com";

const TEXTS: Record<string, { subject: string; title: string; intro: string; emoji: string }> = {
  processing: {
    subject: "Ihre Bestellung wird bearbeitet",
    title: "In Bearbeitung",
    intro: "wir bearbeiten Ihre Bestellung gerade – Sie hören wieder von uns, sobald das Paket unterwegs ist.",
    emoji: "⚙️",
  },
  shipped: {
    subject: "Ihre Bestellung wurde versendet",
    title: "Versendet",
    intro: "Ihre Bestellung ist unterwegs zu Ihnen.",
    emoji: "📦",
  },
  delivered: {
    subject: "Ihre Bestellung wurde geliefert",
    title: "Geliefert",
    intro: "Ihre Bestellung wurde ausgeliefert. Wir hoffen, alles passt bestens!",
    emoji: "✅",
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { order_id, status, tracking_nr } = await req.json();
    const text = TEXTS[status];
    if (!order_id || !text) {
      return new Response(JSON.stringify({ error: "order_id und gültiger status erforderlich" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: order } = await supabase
      .from("shop_orders")
      .select("id, customer_name, customer_email, total")
      .eq("id", order_id)
      .maybeSingle();

    if (!order?.customer_email) {
      return new Response(JSON.stringify({ error: "Bestellung oder E-Mail nicht gefunden" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nr = String(order.id).slice(0, 8).toUpperCase();
    const trackingBlock = status === "shipped" && tracking_nr
      ? `<p style="margin:16px 0 0;font-size:14px;"><strong>Sendungsnummer:</strong> ${tracking_nr}</p>
         <p style="margin:4px 0 0;font-size:13px;color:#666;">Sendung verfolgen: <a href="https://service.post.ch/ekp-web/ui/entry/search/${tracking_nr}" style="color:#16a34a;">Post CH Tracking</a></p>`
      : "";

    const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [order.customer_email],
      reply_to: REPLY_TO,
      subject: `${text.subject} · Bestellung #${nr}`,
      html: `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111;">
        <p style="font-size:28px;margin:0;">${text.emoji}</p>
        <h1 style="font-size:20px;margin:8px 0 4px;">${text.title}</h1>
        <p style="font-size:14px;color:#555;margin:0 0 16px;">Bestellung #${nr}</p>
        <p style="font-size:15px;line-height:1.6;">Guten Tag ${order.customer_name || ""},<br/>${text.intro}</p>
        ${trackingBlock}
        <p style="margin:20px 0 0;font-size:14px;"><strong>Bestellwert:</strong> CHF ${Number(order.total || 0).toFixed(2)}</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
        <p style="font-size:12px;color:#888;">3DMuscio · Gartensiedlung 13 · 8360 Eschlikon TG<br/>info@3dmuscio.com · 3dmuscio.com</p>
      </div>`,
    });

    if (error) throw new Error(JSON.stringify(error));

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("notify-shop-order-status error", e);
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
