// Versendet einen Newsletter an eine Empfängerliste via Resend (nur Admins).
import { Resend } from "npm:resend@2";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = "https://3dmuscio.com";
const LOGO_URL =
  "https://ukqtjdsjmtxgzhklvqky.supabase.co/storage/v1/object/public/company-assets/logo.jpeg";

const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function esc(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isSafeUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

export function renderNewsletter(opts: {
  inhalt: string;
  name?: string | null;
  email: string;
  bildUrl?: string | null;
  blogUrl?: string | null;
  blogTitel?: string | null;
}) {
  const { inhalt, name, email, bildUrl, blogUrl, blogTitel } = opts;

  const text = String(inhalt ?? "")
    .replace(/\[Kundenname\]/g, name?.trim() || "geschätzter Kunde")
    .replace(/\[LINK_KALKULATOR\]/g, "");

  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="font-size:15px;line-height:1.7;color:#3f3f46;margin:0 0 16px;">${esc(p).replace(/\n/g, "<br/>")}</p>`,
    )
    .join("");

  const imageBlock = bildUrl && isSafeUrl(bildUrl)
    ? `<tr><td style="padding:0 0 8px;"><img src="${esc(bildUrl)}" alt="" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;" /></td></tr>`
    : "";

  const blogBlock = blogUrl && isSafeUrl(blogUrl)
    ? `<tr><td style="padding:8px 32px 32px;">
          <div style="background-color:#f4f4f5;border-radius:10px;padding:18px 20px;">
            <p style="margin:0 0 8px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#71717a;font-weight:700;">Lesenswerter Beitrag</p>
            <a href="${esc(blogUrl)}" style="font-size:15px;font-weight:600;color:#16a34a;text-decoration:none;">📖 ${esc(blogTitel || "Zum Beitrag")} →</a>
          </div>
        </td></tr>`
    : "";

  const unsubUrl = `${SITE_URL}/newsletter/abmelden?email=${encodeURIComponent(email)}`;

  return `<!DOCTYPE html>
<html lang="de" dir="ltr">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
  <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background-color:#ffffff;border-radius:14px;overflow:hidden;">
          <tr>
            <td style="padding:24px 32px;background-color:#0f172a;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td style="padding-right:12px;"><img src="${LOGO_URL}" alt="3DMuscio" width="40" height="40" style="display:block;border-radius:8px;" /></td>
                <td>
                  <div style="font-size:17px;font-weight:700;color:#ffffff;line-height:1.2;">3DMuscio</div>
                  <div style="font-size:12px;color:#9ca3af;line-height:1.4;">3D-Druck Schweiz</div>
                </td>
              </tr></table>
            </td>
          </tr>
          ${imageBlock}
          <tr><td style="padding:28px 32px 8px;">${paragraphs}</td></tr>
          <tr><td style="padding:8px 32px 24px;" align="center">
            <a href="${SITE_URL}/kalkulator-online" style="background-color:#16a34a;color:#ffffff;padding:14px 30px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;display:inline-block;">Jetzt Preis berechnen →</a>
          </td></tr>
          ${blogBlock}
          <tr><td style="padding:20px 32px 28px;border-top:1px solid #e4e4e7;">
            <p style="margin:0 0 10px;font-size:12px;line-height:1.6;color:#71717a;">
              3DMuscio | Gartensiedlung 13, 8360 Eschlikon TG |
              <a href="mailto:info@3dmuscio.com" style="color:#71717a;">info@3dmuscio.com</a> |
              <a href="${SITE_URL}" style="color:#71717a;">www.3dmuscio.com</a>
            </p>
            <p style="margin:0;font-size:12px;color:#a1a1aa;">
              <a href="${esc(unsubUrl)}" style="color:#a1a1aa;text-decoration:underline;">Vom Newsletter abmelden</a>
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "Nicht angemeldet" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "Nicht angemeldet" }, 401);
    const { data: isAdmin } = await userClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Kein Zugriff" }, 403);

    const body = await req.json().catch(() => ({}));
    const newsletterId = typeof body?.newsletter_id === "string" ? body.newsletter_id : "";
    const empfaenger = Array.isArray(body?.empfaenger) ? body.empfaenger : [];
    if (!newsletterId) return json({ error: "newsletter_id fehlt" }, 400);
    if (empfaenger.length === 0) return json({ error: "Keine Empfänger" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: nl, error: nlErr } = await admin
      .from("newsletters")
      .select("*")
      .eq("id", newsletterId)
      .maybeSingle();
    if (nlErr || !nl) return json({ error: "Newsletter nicht gefunden" }, 404);

    // Unterdrückte Adressen ausschliessen
    const { data: suppressed } = await admin.from("suppressed_emails").select("email");
    const blocked = new Set((suppressed ?? []).map((s: { email: string }) => s.email.toLowerCase()));

    const list = empfaenger
      .filter((r: { email?: string }) => typeof r?.email === "string" && /.+@.+\..+/.test(r.email))
      .filter((r: { email: string }) => !blocked.has(r.email.toLowerCase()));

    let sent = 0;
    const failed: string[] = [];

    for (const r of list) {
      const html = renderNewsletter({
        inhalt: nl.inhalt_text,
        name: r.name,
        email: r.email,
        bildUrl: nl.bild_url,
        blogUrl: nl.blog_link_url,
        blogTitel: nl.blog_link_titel,
      });

      const { error } = await resend.emails.send({
        from: "3DMuscio <noreply@3dmuscio.com>",
        to: [r.email],
        subject: nl.betreff,
        html,
      });

      const ok = !error;
      if (ok) sent++;
      else {
        failed.push(r.email);
        console.error("Resend Fehler für", r.email, error);
      }

      await admin.from("newsletter_empfaenger").insert({
        newsletter_id: newsletterId,
        customer_id: r.customer_id ?? null,
        email: r.email,
        name: r.name ?? null,
        gesendet: ok,
        gesendet_am: ok ? new Date().toISOString() : null,
      });

      await new Promise((res) => setTimeout(res, 120));
    }

    await admin
      .from("newsletters")
      .update({
        status: "gesendet",
        gesendet_am: new Date().toISOString(),
        empfaenger_anzahl: sent,
        inhalt_html: renderNewsletter({
          inhalt: nl.inhalt_text,
          name: "[Kundenname]",
          email: "beispiel@3dmuscio.com",
          bildUrl: nl.bild_url,
          blogUrl: nl.blog_link_url,
          blogTitel: nl.blog_link_titel,
        }),
      })
      .eq("id", newsletterId);

    return json({ success: true, sent, failed });
  } catch (err) {
    console.error("send-newsletter Fehler:", err);
    return json({ error: String(err) }, 500);
  }
});
