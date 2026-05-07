import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.0.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FROM = "3DMuscio <info@3dmuscio.com>";
const REPLY_TO = "info@3dmuscio.com";
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

function htmlBody(text: string, quotedHistory?: string) {
  const safe = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>");
  const quoted = quotedHistory
    ? `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" /><div style="color:#6b7280;font-size:13px;">${quotedHistory}</div>`
    : "";
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,Segoe UI,Arial,sans-serif;color:#1a1a1a;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background:#18181b;padding:18px 24px;border-radius:12px 12px 0 0;width:100%;border-collapse:separate;">
      <tr>
        <td width="40" style="vertical-align:middle;padding-right:12px;">
          <img src="https://ukqtjdsjmtxgzhklvqky.supabase.co/storage/v1/object/public/company-assets/logo.jpeg" width="40" height="40" style="border-radius:8px;display:block;" alt="3DMuscio"/>
        </td>
        <td style="vertical-align:middle;color:#fff;font-size:18px;font-weight:700;font-family:-apple-system,Segoe UI,Arial,sans-serif;line-height:40px;">3DMuscio</td>
      </tr>
    </table>
    <div style="background:#fff;padding:28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;line-height:1.6;font-size:14px;">
      <div>${safe}</div>
      ${quoted}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 12px;" />
      <div style="text-align:center;font-size:12px;color:#9ca3af;">
        Antworten Sie einfach auf diese E-Mail.<br/>
        <a href="mailto:info@3dmuscio.com" style="color:#22c55e;text-decoration:none;">info@3dmuscio.com</a>
        &nbsp;·&nbsp; <a href="https://3dmuscio.com" style="color:#22c55e;text-decoration:none;">3dmuscio.com</a>
      </div>
    </div>
  </div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } }
    );

    // Auth-Check: nur Admins
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    if (!roles?.some((r: any) => r.role === "admin")) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { inquiry_id, message } = await req.json();
    if (!inquiry_id || !message?.trim()) {
      return new Response(JSON.stringify({ error: "inquiry_id und message erforderlich" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Service-role client für DB
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: inq, error: inqErr } = await admin.from("inquiries").select("id, name, email, betreff").eq("id", inquiry_id).maybeSingle();
    if (inqErr || !inq) throw inqErr || new Error("Anfrage nicht gefunden");

    const subject = (inq.betreff && !inq.betreff.toLowerCase().startsWith("re:")) ? `Re: ${inq.betreff}` : (inq.betreff || "Ihre Anfrage bei 3DMuscio");

    // Letzte Nachricht für In-Reply-To
    const { data: lastMsg } = await admin.from("inquiry_messages").select("message_id").eq("inquiry_id", inquiry_id).order("created_at", { ascending: false }).limit(1).maybeSingle();

    const headers: Record<string, string> = {};
    if (lastMsg?.message_id) {
      headers["In-Reply-To"] = lastMsg.message_id;
      headers["References"] = lastMsg.message_id;
    }

    const sendRes = await resend.emails.send({
      from: FROM,
      to: [inq.email],
      reply_to: REPLY_TO,
      subject,
      html: htmlBody(message),
      text: message,
      headers,
    });

    if (sendRes.error) throw new Error(sendRes.error.message);

    const messageId = (sendRes.data as any)?.id ? `<${(sendRes.data as any).id}@3dmuscio.com>` : null;

    await admin.from("inquiry_messages").insert({
      inquiry_id,
      direction: "out",
      from_email: REPLY_TO,
      from_name: "3DMuscio",
      to_email: inq.email,
      subject,
      body: message,
      body_html: htmlBody(message),
      message_id: messageId,
      in_reply_to: lastMsg?.message_id || null,
    });

    // Anfrage-Status auf "In Bearbeitung" setzen falls Neu
    await admin.from("inquiries").update({ status: "In Bearbeitung", updated_at: new Date().toISOString() }).eq("id", inquiry_id).eq("status", "Neu");

    return new Response(JSON.stringify({ success: true, message_id: messageId }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("inquiry-reply error", err);
    return new Response(JSON.stringify({ error: err?.message || "Fehler" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
