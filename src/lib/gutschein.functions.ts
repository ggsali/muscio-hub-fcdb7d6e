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
  const wert = wertLabel(input.typ, Number(input.wert));
  const gueltig = input.gueltig_bis ? new Date(input.gueltig_bis).toLocaleDateString("de-CH") : null;
  const anrede = input.recipientName ? `Hallo ${escapeHtml(input.recipientName)}` : "Hallo";
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#111;">
    <h1 style="color:#FF5A00;margin-bottom:4px;">Dein 3DMuscio Gutschein</h1>
    <p>${anrede}</p>
    ${input.message ? `<p style="white-space:pre-wrap;">${escapeHtml(input.message)}</p>` : ""}
    <p>Hier ist dein Gutschein für <strong>${wert}</strong>:</p>
    <div style="border:2px dashed #FF5A00;border-radius:12px;padding:20px;text-align:center;margin:24px 0;">
      <div style="font-size:12px;letter-spacing:2px;color:#666;text-transform:uppercase;">Gutschein-Code</div>
      <div style="font-size:28px;font-weight:bold;letter-spacing:3px;margin-top:8px;">${escapeHtml(input.code)}</div>
      <div style="font-size:14px;color:#666;margin-top:8px;">${wert}</div>
    </div>
    <ul style="color:#444;font-size:14px;line-height:1.6;">
      ${(input.mindestbestellwert ?? 0) > 0 ? `<li>Mindestbestellwert: CHF ${Number(input.mindestbestellwert).toFixed(2)}</li>` : ""}
      ${gueltig ? `<li>Gültig bis: ${gueltig}</li>` : ""}
      <li>Einlösbar im Shop und im Online-Kalkulator</li>
    </ul>
    <p style="margin-top:24px;">
      <a href="https://3dmuscio.com/kalkulator-online" style="background:#FF5A00;color:#fff;padding:12px 20px;text-decoration:none;border-radius:8px;display:inline-block;">Jetzt einlösen &rarr;</a>
    </p>
    <p style="color:#888;font-size:12px;margin-top:32px;">3DMuscio &middot; 3D-Druck aus der Schweiz &middot; info@3dmuscio.com</p>
  </div>`;
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
