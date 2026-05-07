import { Resend } from "npm:resend@4.0.1";
import { Webhook } from "npm:standardwebhooks@1.0.0";

const FROM_EMAIL = "3DMuscio <noreply@3dmuscio.com>";
const REPLY_TO = "info@3dmuscio.com";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

function layout(title: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;color:#1a1a1a;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#18181b;padding:24px 32px;border-radius:12px 12px 0 0;display:flex;align-items:center;gap:14px;">
      <img src="https://ukqtjdsjmtxgzhklvqky.supabase.co/storage/v1/object/public/company-assets/logo.jpeg" alt="3DMuscio" width="44" height="44" style="border-radius:8px;display:block;" />
      <span style="color:#ffffff;font-size:20px;font-weight:700;">3DMuscio</span>
    </div>
    <div style="background:#ffffff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;line-height:1.6;font-size:14px;">
      <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#000;">${title}</h1>
      ${body}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 16px;" />
      <div style="text-align:center;font-size:12px;color:#9ca3af;">
        <a href="mailto:info@3dmuscio.com" style="color:#22c55e;text-decoration:none;">info@3dmuscio.com</a>
        &nbsp;·&nbsp; +41 79 839 50 80 &nbsp;·&nbsp;
        <a href="https://3dmuscio.com" style="color:#22c55e;text-decoration:none;">3dmuscio.com</a>
      </div>
    </div>
  </div>
</body></html>`;
}

function btn(url: string, label: string): string {
  return `<div style="margin:24px 0;text-align:center;"><a href="${url}" style="display:inline-block;background:#18181b;color:#fff;font-weight:700;padding:14px 32px;border-radius:8px;text-decoration:none;">${label}</a></div>`;
}

function buildEmail(actionType: string, link: string, recipient: string, token?: string): { subject: string; html: string } {
  switch (actionType) {
    case "signup":
      return {
        subject: "E-Mail-Adresse bestätigen – 3DMuscio",
        html: layout("E-Mail-Adresse bestätigen", `<p>Vielen Dank für Ihre Registrierung bei <strong>3DMuscio</strong>!</p><p>Bitte bestätigen Sie Ihre E-Mail-Adresse (${recipient}) mit einem Klick:</p>${btn(link, "E-Mail bestätigen")}<p style="font-size:12px;color:#999;">Falls Sie kein Konto erstellt haben, ignorieren Sie diese E-Mail.</p>`),
      };
    case "recovery":
      return {
        subject: "Passwort zurücksetzen – 3DMuscio",
        html: layout("Passwort zurücksetzen", `<p>Wir haben eine Anfrage erhalten, dein Passwort zurückzusetzen.</p>${btn(link, "Passwort zurücksetzen")}<p style="font-size:12px;color:#999;">Falls du keine Anfrage gestellt hast, ignoriere diese E-Mail.</p>`),
      };
    case "magiclink":
      return {
        subject: "Dein Login-Link – 3DMuscio",
        html: layout("Mit einem Klick einloggen", `<p>Klicke auf den Button um dich einzuloggen. Der Link ist 60 Minuten gültig.</p>${btn(link, "Jetzt einloggen")}`),
      };
    case "invite":
      return {
        subject: "Du wurdest zu 3DMuscio eingeladen",
        html: layout("Einladung", `<p>Du wurdest eingeladen, 3DMuscio beizutreten.</p>${btn(link, "Einladung annehmen")}`),
      };
    case "email_change":
    case "email_change_new":
      return {
        subject: "E-Mail-Änderung bestätigen – 3DMuscio",
        html: layout("E-Mail-Änderung bestätigen", `<p>Bitte bestätige die Änderung deiner E-Mail-Adresse.</p>${btn(link, "Änderung bestätigen")}`),
      };
    case "reauthentication":
      return {
        subject: "Bestätigungscode – 3DMuscio",
        html: layout("Bestätigungscode", `<p>Dein Bestätigungscode lautet:</p><div style="text-align:center;font-size:32px;font-weight:700;letter-spacing:0.2em;margin:24px 0;color:#18181b;">${token || ""}</div>`),
      };
    default:
      return {
        subject: "Aktion erforderlich – 3DMuscio",
        html: layout("Aktion erforderlich", `${btn(link, "Weiter")}`),
      };
  }
}

Deno.serve(async (req) => {
  try {
    const payload = await req.text();
    const headers = Object.fromEntries(req.headers);

    const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
    if (!hookSecret) {
      console.error("SEND_EMAIL_HOOK_SECRET not configured");
      return new Response(JSON.stringify({ error: "Hook secret missing" }), { status: 500 });
    }

    // Standard Webhooks: secret may be prefixed with v1,whsec_
    const secret = hookSecret.replace(/^v1,/, "");
    const wh = new Webhook(secret);
    const data = wh.verify(payload, headers) as {
      user: { email: string };
      email_data: {
        token: string;
        token_hash: string;
        redirect_to: string;
        email_action_type: string;
        site_url: string;
        token_new?: string;
        token_hash_new?: string;
      };
    };

    const { user, email_data } = data;
    const link = `${email_data.site_url}/auth/v1/verify?token=${email_data.token_hash}&type=${email_data.email_action_type}&redirect_to=${encodeURIComponent(email_data.redirect_to)}`;

    const { subject, html } = buildEmail(email_data.email_action_type, link, user.email, email_data.token);

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: user.email,
      reply_to: REPLY_TO,
      subject,
      html,
    });

    if (error) {
      console.error("Resend error:", error);
      return new Response(JSON.stringify({ error: String((error as any).message || error) }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Auth email hook error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500 });
  }
});
