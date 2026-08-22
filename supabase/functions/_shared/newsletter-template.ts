// Gemeinsames HTML-Template für Newsletter (Versand + Automationen) inkl. Tracking.
const SITE_URL = "https://3dmuscio.com";
const LOGO_URL =
  "https://ukqtjdsjmtxgzhklvqky.supabase.co/storage/v1/object/public/company-assets/logo.jpeg";

export function trackBase() {
  return `${Deno.env.get("SUPABASE_URL")}/functions/v1/newsletter-track`;
}

export function esc(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function isSafeUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

/** Baut einen Klick-Tracking-Link (fällt ohne trackId auf die Original-URL zurück). */
export function trackedUrl(original: string, trackId?: string | null) {
  if (!trackId || !isSafeUrl(original)) return original;
  return `${trackBase()}?a=click&id=${encodeURIComponent(trackId)}&url=${encodeURIComponent(original)}`;
}

export function renderNewsletter(opts: {
  inhalt: string;
  name?: string | null;
  email: string;
  bildUrl?: string | null;
  blogUrl?: string | null;
  blogTitel?: string | null;
  trackId?: string | null;
}) {
  const { inhalt, name, email, bildUrl, blogUrl, blogTitel, trackId } = opts;

  const text = String(inhalt ?? "")
    .replace(/\[Kundenname\]/g, name?.trim() || "geschätzter Kunde")
    .replace(/\[LINK_KALKULATOR\]/g, "");

  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      // Rohe URLs im Text in getrackte Links umwandeln
      const html = esc(p)
        .replace(/\n/g, "<br/>")
        .replace(/(https?:\/\/[^\s<]+)/g, (m) =>
          `<a href="${esc(trackedUrl(m, trackId))}" style="color:#16a34a;">${esc(m)}</a>`,
        );
      return `<p style="font-size:15px;line-height:1.7;color:#3f3f46;margin:0 0 16px;">${html}</p>`;
    })
    .join("");

  const imageBlock = bildUrl && isSafeUrl(bildUrl)
    ? `<tr><td style="padding:0 0 8px;"><img src="${esc(bildUrl)}" alt="" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;" /></td></tr>`
    : "";

  const blogBlock = blogUrl && isSafeUrl(blogUrl)
    ? `<tr><td style="padding:8px 32px 32px;">
          <div style="background-color:#f4f4f5;border-radius:10px;padding:18px 20px;">
            <p style="margin:0 0 8px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#71717a;font-weight:700;">Lesenswerter Beitrag</p>
            <a href="${esc(trackedUrl(blogUrl, trackId))}" style="font-size:15px;font-weight:600;color:#16a34a;text-decoration:none;">📖 ${esc(blogTitel || "Zum Beitrag")} →</a>
          </div>
        </td></tr>`
    : "";

  const ctaUrl = trackedUrl(`${SITE_URL}/kalkulator-online`, trackId);
  const unsubUrl = `${SITE_URL}/newsletter/abmelden?email=${encodeURIComponent(email)}`;
  const pixel = trackId
    ? `<img src="${esc(`${trackBase()}?a=open&id=${encodeURIComponent(trackId)}`)}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;border:0;" />`
    : "";

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
            <a href="${esc(ctaUrl)}" style="background-color:#16a34a;color:#ffffff;padding:14px 30px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;display:inline-block;">Jetzt Preis berechnen →</a>
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
    ${pixel}
  </body>
</html>`;
}
