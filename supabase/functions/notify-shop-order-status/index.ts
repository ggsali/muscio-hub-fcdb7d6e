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

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    // Nur eingeloggte Admins dürfen Status-Mails an Kunden auslösen.
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return jsonResponse({ error: "Nicht autorisiert" }, 401);

    const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData?.user) return jsonResponse({ error: "Nicht autorisiert" }, 401);

    const { data: isAdmin, error: roleError } = await authClient.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (roleError || !isAdmin) return jsonResponse({ error: "Keine Berechtigung" }, 403);

    const { order_id, status, tracking_nr } = await req.json();
    const text = TEXTS[status];
    if (!order_id || !text) {
      return jsonResponse({ error: "order_id und gültiger status erforderlich" }, 400);
    }

    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: order } = await supabase
      .from("shop_orders")
      .select("id, customer_name, customer_email, total")
      .eq("id", order_id)
      .maybeSingle();

    if (!order?.customer_email) {
      return jsonResponse({ error: "Bestellung oder E-Mail nicht gefunden" }, 404);
    }

    const nr = String(order.id).slice(0, 8).toUpperCase();
    const trackingRaw = String(tracking_nr ?? "").trim().slice(0, 60);
    const trackingSafe = escapeHtml(trackingRaw);
    const trackingUrlSafe = encodeURIComponent(trackingRaw);
    const trackingBlock = status === "shipped" && trackingRaw
      ? `<p style="margin:16px 0 0;font-size:14px;"><strong>Sendungsnummer:</strong> ${trackingSafe}</p>
         <p style="margin:4px 0 0;font-size:13px;color:#666;">Sendung verfolgen: <a href="https://service.post.ch/ekp-web/ui/entry/search/${trackingUrlSafe}" style="color:#FF5A00;">Post CH Tracking</a></p>`
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
        <p style="font-size:15px;line-height:1.6;">Guten Tag ${escapeHtml(order.customer_name || "")},<br/>${text.intro}</p>
        ${trackingBlock}
        <p style="margin:20px 0 0;font-size:14px;"><strong>Bestellwert:</strong> CHF ${Number(order.total || 0).toFixed(2)}</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
        <p style="font-size:12px;color:#888;">3DMuscio · Gartensiedlung 13 · 8360 Eschlikon TG<br/>info@3dmuscio.com · 3dmuscio.com</p>
      </div>`,
    });

    if (error) throw new Error(JSON.stringify(error));

    return jsonResponse({ success: true });
  } catch (e) {
    console.error("notify-shop-order-status error", e);
    return jsonResponse({ error: "Versand fehlgeschlagen" }, 500);
  }
});
