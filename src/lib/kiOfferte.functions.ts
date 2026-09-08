import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const filamentSchema = z.object({
  name: z.string().max(120),
  material: z.string().max(60).nullable().optional(),
  farbe: z.string().max(60).nullable().optional(),
  preis_pro_g: z.number().nonnegative(),
});

const generateSchema = z.object({
  prompt: z.string().trim().min(3).max(4000),
  kundenName: z.string().trim().max(160).optional(),
  preise: z.object({
    setup_pauschale: z.number().nonnegative(),
    maschinenzeit_pro_h: z.number().nonnegative(),
    nachbearbeitung_pro_h: z.number().nonnegative(),
    konstruktion_pro_h: z.number().nonnegative(),
    filamente: z.array(filamentSchema).max(200),
  }),
});

export interface KiPosition {
  bezeichnung: string;
  beschreibung: string;
  menge: number;
  einheit: string;
  einzelpreis: number;
}

export interface KiOfferteResult {
  titel: string;
  positionen: KiPosition[];
  rabatt_prozent: number;
  mwst_prozent: number;
  gueltigkeitsdauer: string;
  zahlungsbedingungen: string;
  notiz: string;
}

/** KI-Offerte aus einer Beschreibung + echten Preisen generieren (nur Admins). */
export const generateKiOfferte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => generateSchema.parse(data))
  .handler(async ({ data, context }): Promise<KiOfferteResult> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("KI ist nicht konfiguriert");

    const p = data.preise;
    const filamentListe =
      p.filamente.map((f) => `  - ${f.name} (${f.material ?? "—"}): CHF ${f.preis_pro_g.toFixed(3)}/g`).join("\n") ||
      "  - PLA Standard: CHF 0.055/g";

    const systemPrompt = `Du bist ein Offerten-Assistent für 3DMuscio, Schweizer 3D-Druckservice in Eschlikon TG.

AKTUELLE PREISE (diese immer verwenden, keine anderen):

MATERIALPREISE (pro Gramm):
${filamentListe}

DIENSTLEISTUNGSPREISE:
- Setup-Pauschale: CHF ${p.setup_pauschale} (einmalig pro Auftrag, IMMER als eigene Position hinzufügen)
- Maschinenzeit: CHF ${p.maschinenzeit_pro_h}/h
- Nachbearbeitung: CHF ${p.nachbearbeitung_pro_h}/h
- Konstruktionszeit: CHF ${p.konstruktion_pro_h}/h
- Versand Post Priority: CHF 8
- Express-Aufpreis: +25% auf Gesamtbetrag

RECHENREGELN:
- Setup-Pauschale IMMER als eigene Position hinzufügen
- Materialkosten = Gewicht (g) × Preis/g
- Maschinenzeit: kleine Teile (<50g) ~30min, mittlere (50-200g) ~2h, grosse (>200g) ~4-8h
- Falls Material nicht spezifiziert: günstigstes verfügbares Material
- Alle CHF-Werte auf 2 Dezimalstellen runden
- Menge × Einzelpreis = Total pro Position

Antworte NUR mit gültigem JSON in genau dieser Struktur:
{
  "titel": "Offerte – [kurze Beschreibung]",
  "positionen": [
    { "bezeichnung": "FDM 3D-Druck PLA Basic Schwarz", "beschreibung": "150g × CHF 0.055/g + 2h Maschinenzeit × CHF ${p.maschinenzeit_pro_h}/h", "menge": 2, "einheit": "Stück", "einzelpreis": 14.25, "total": 28.50 },
    { "bezeichnung": "Setup-Pauschale", "beschreibung": "Einmalige Bearbeitungsgebühr", "menge": 1, "einheit": "Pauschal", "einzelpreis": ${p.setup_pauschale}, "total": ${p.setup_pauschale} }
  ],
  "zwischensumme": 48.50,
  "rabatt_prozent": 0,
  "mwst_prozent": 0,
  "gesamttotal": 48.50,
  "gueltigkeitsdauer": "30 Tage",
  "zahlungsbedingungen": "Zahlung innerhalb 30 Tagen nach Rechnungsdatum.",
  "notiz": ""
}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Beschreibung: ${data.prompt}\nKunde: ${data.kundenName || "Unbekannt"}` },
        ],
      }),
    });

    if (resp.status === 429) throw new Error("Zu viele Anfragen, bitte kurz warten.");
    if (resp.status === 402) throw new Error("KI-Guthaben aufgebraucht.");
    if (!resp.ok) {
      console.error("[generateKiOfferte] AI error", resp.status, await resp.text());
      throw new Error("KI-Anfrage fehlgeschlagen");
    }

    const aiData = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
    const text = aiData.choices?.[0]?.message?.content ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(match?.[0] ?? "{}") as Record<string, unknown>;
    } catch {
      console.error("[generateKiOfferte] parse error", text.slice(0, 400));
      throw new Error("KI-Antwort konnte nicht verarbeitet werden");
    }

    const rawPositions = Array.isArray(parsed["positionen"]) ? (parsed["positionen"] as Record<string, unknown>[]) : [];
    if (rawPositions.length === 0) throw new Error("KI-Antwort enthielt keine Positionen");

    return {
      titel: String(parsed["titel"] ?? "KI-Offerte"),
      positionen: rawPositions.map((r) => ({
        bezeichnung: String(r["bezeichnung"] ?? "Position"),
        beschreibung: String(r["beschreibung"] ?? ""),
        menge: Number(r["menge"]) || 1,
        einheit: String(r["einheit"] ?? "Stück"),
        einzelpreis: Number(r["einzelpreis"]) || 0,
      })),
      rabatt_prozent: Number(parsed["rabatt_prozent"]) || 0,
      mwst_prozent: Number(parsed["mwst_prozent"]) || 0,
      gueltigkeitsdauer: String(parsed["gueltigkeitsdauer"] ?? "30 Tage"),
      zahlungsbedingungen: String(
        parsed["zahlungsbedingungen"] ?? "Zahlung innerhalb 30 Tagen nach Rechnungsdatum.",
      ),
      notiz: String(parsed["notiz"] ?? ""),
    };
  });

const mailSchema = z.object({
  to: z.string().trim().email().max(255),
  customerName: z.string().trim().max(160).optional(),
  titel: z.string().trim().max(200),
  total: z.number().nonnegative(),
  gueltigkeitsdauer: z.string().trim().max(80),
  pdfBase64: z.string().min(10),
  pdfFilename: z.string().trim().max(160),
});

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** KI-Offerte als PDF per E-Mail versenden (nur Admins). */
export const sendKiOfferteMail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => mailSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const apiKey = process.env["RESEND_API_KEY"];
    if (!apiKey) throw new Error("E-Mail-Versand ist nicht konfiguriert");

    const name = escapeHtml(data.customerName?.trim() || "Kundin/Kunde");
    const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f3f4f6;font-family:Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#111827;padding:24px;text-align:center;">
          <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">3DMuscio</p>
          <p style="margin:6px 0 0;color:#00cc66;font-size:13px;">Ihre Offerte</p>
        </td></tr>
        <tr><td style="padding:28px;color:#111827;font-size:15px;line-height:1.6;">
          <p style="margin:0 0 12px;">Guten Tag ${name},</p>
          <p style="margin:0 0 16px;">gerne senden wir Ihnen unsere Offerte <strong>${escapeHtml(data.titel)}</strong> als PDF im Anhang.</p>
          <p style="margin:0 0 16px;padding:14px;background:#f0fdf4;border-left:3px solid #00cc66;border-radius:6px;">
            Gesamtbetrag: <strong>CHF ${data.total.toFixed(2)}</strong><br />
            Gültigkeit: ${escapeHtml(data.gueltigkeitsdauer)}
          </p>
          <p style="margin:0 0 16px;">Bei Fragen antworten Sie einfach auf diese E-Mail.</p>
          <p style="margin:0;">Freundliche Grüsse<br /><strong>3DMuscio</strong></p>
        </td></tr>
        <tr><td style="background:#111827;padding:18px;text-align:center;color:#9ca3af;font-size:12px;">
          3DMuscio · Gartensiedlung 13, 8360 Eschlikon TG<br />
          <a href="mailto:info@3dmuscio.com" style="color:#9ca3af;text-decoration:none;">info@3dmuscio.com</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "3DMuscio <noreply@3dmuscio.com>",
        to: [data.to],
        reply_to: "info@3dmuscio.com",
        subject: `Ihre Offerte von 3DMuscio – ${data.titel}`,
        html,
        attachments: [{ filename: data.pdfFilename, content: data.pdfBase64 }],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("[sendKiOfferteMail] Resend error", res.status, detail);
      throw new Error("E-Mail-Versand fehlgeschlagen");
    }
    return { success: true as const };
  });
