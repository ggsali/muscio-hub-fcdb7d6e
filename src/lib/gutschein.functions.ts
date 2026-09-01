import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  code: z.string().trim().min(3).max(40),
  typ: z.enum(["prozent", "betrag", "gratis_versand"]),
  wert: z.number().nonnegative(),
  mindestbestellwert: z.number().nonnegative().nullable().optional(),
  gueltig_bis: z.string().trim().max(20).nullable().optional(),
  recipientEmail: z.string().trim().email().max(255),
  recipientName: z.string().trim().max(120).nullable().optional(),
  message: z.string().trim().max(1000).nullable().optional(),
});

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const wertLabel = (typ: string, wert: number) =>
  typ === "prozent"
    ? `${wert}% Rabatt`
    : typ === "betrag"
      ? `CHF ${wert.toFixed(2)} Guthaben`
      : "Gratis Versand";

export function buildGutscheinEmailHtml(input: {
  code: string;
  typ: string;
  wert: number;
  mindestbestellwert?: number | null;
  gueltig_bis?: string | null;
  recipientName?: string | null;
  message?: string | null;
}): string {
  const wertLabel = (typ: string, wert: number) =>
    typ === "prozent" ? `${wert}% Rabatt`
    : typ === "betrag" ? `CHF ${wert.toFixed(2)} Rabatt`
    : "Gratis Versand";

  const rabattText = wertLabel(input.typ, Number(input.wert));
  const gueltig = input.gueltig_bis
    ? new Date(input.gueltig_bis).toLocaleDateString("de-CH")
    : null;
  const anrede = input.recipientName
    ? `Guten Tag ${escapeHtml(input.recipientName.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" "))},`
    : "Guten Tag,";

  return `
<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Dein 3DMuscio Gutschein</title>
  </head>
  <body style="margin:0;padding:0;background-color:#ffffff;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff;">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);border:1px solid #e5e7eb;">
            <tr>
              <td style="background-color:#1a1a1a;padding:32px 40px;text-align:center;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="text-align:center;">
                      <div style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:1px;">3DMuscio</div>
                      <div style="font-size:12px;color:#ffffff;text-transform:uppercase;letter-spacing:2px;margin-top:4px;opacity:0.9;">3D-Druck Schweiz</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="text-align:center;padding-top:16px;">
                      <div style="font-size:48px;line-height:1;">🎁</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:40px;">
                <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#111827;">${anrede}</p>
                <p style="margin:0 0 24px 0;font-size:16px;line-height:1.6;color:#374151;white-space:pre-wrap;">${input.message ? escapeHtml(input.message) : "Sie erhalten einen persönlichen Gutschein von 3DMuscio. Lösen Sie ihn bei Ihrer nächsten Bestellung ein."}</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#fff7ed;border:2px dashed #FF5A00;border-radius:12px;margin:24px 0;">
                  <tr>
                    <td style="padding:24px;text-align:center;">
                      <div style="font-size:12px;letter-spacing:2px;color:#c2410c;text-transform:uppercase;">Ihr persönlicher Gutscheincode</div>
                      <div style="font-size:32px;font-weight:700;letter-spacing:4px;color:#111827;margin:12px 0;">${escapeHtml(input.code)}</div>
                      <div style="font-size:16px;font-weight:600;color:#FF5A00;">${rabattText}</div>
                      ${gueltig ? `<div style="font-size:13px;color:#c2410c;margin-top:8px;">Gültig bis ${gueltig}</div>` : ""}
                    </td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:24px;">
                  ${Number(input.mindestbestellwert ?? 0) > 0 ? `
                  <tr>
                    <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-size:14px;color:#6b7280;">Mindestbestellwert</td>
                    <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;font-size:14px;font-weight:600;color:#111827;">CHF ${Number(input.mindestbestellwert).toFixed(2)}</td>
                  </tr>
                  ` : ""}
                  <tr>
                    <td style="padding:8px 0;font-size:14px;color:#6b7280;">Einlösbar</td>
                    <td style="padding:8px 0;text-align:right;font-size:14px;font-weight:600;color:#111827;">Kalkulator & Shop</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 40px 40px;text-align:center;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">
                  <tr>
                    <td style="background-color:#FF5A00;border-radius:8px;text-align:center;">
                      <a href="https://3dmuscio.com/kalkulator-online" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Jetzt Gutschein einlösen →</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px;background-color:#f9fafb;text-align:center;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;">
                  3DMuscio · Gartensiedlung 13, 8360 Eschlikon TG<br />
                  <a href="mailto:info@3dmuscio.com" style="color:#9ca3af;text-decoration:none;">info@3dmuscio.com</a> ·
                  <a href="https://www.3dmuscio.com" style="color:#9ca3af;text-decoration:none;">www.3dmuscio.com</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}

/** Gutschein per E-Mail versenden (nur Admins). */
export const sendGutscheinMail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const apiKey = process.env["RESEND_API_KEY"];
    if (!apiKey) throw new Error("E-Mail-Versand ist nicht konfiguriert");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "3DMuscio <noreply@3dmuscio.com>",
        to: [data.recipientEmail],
        subject: `Dein 3DMuscio Gutschein: ${wertLabel(data.typ, data.wert)}`,
        html: buildGutscheinEmailHtml(data),
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("[sendGutscheinMail] Resend error", res.status, detail);
      throw new Error("E-Mail-Versand fehlgeschlagen");
    }
    return { success: true as const };
  });
