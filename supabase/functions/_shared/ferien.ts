// Ferienmodus: Einstellungen aus website_settings (key "ferienmodus") und Auto-Antwort-Mail.
// value = { von: "YYYY-MM-DD", bis: "YYYY-MM-DD", betreff: string, text: string }

export interface FerienConfig {
  von: string;
  bis: string;
  betreff: string;
  text: string;
}

export const FERIEN_MARKER = "[Ferien-Autoantwort]";

export const DEFAULT_FERIEN_BETREFF = "Wir sind in den Ferien – deine Anfrage ist angekommen";
export const DEFAULT_FERIEN_TEXT =
  "Hallo {name}\n\nvielen Dank für deine Nachricht. Wir sind vom {von} bis {bis} in den Ferien. " +
  "Deine Anfrage ist bei uns eingegangen, wir melden uns ab dem {rueckkehr} bei dir.\n\n" +
  "Freundliche Grüsse\n3DMuscio";

const esc = (v: unknown) =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Heutiges Datum (YYYY-MM-DD) in der Schweiz */
export function todayZurich(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Zurich" }).format(new Date());
}

const fmt = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
};

const nextDay = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/** Liefert die Ferien-Konfiguration nur, wenn heute zwischen von und bis (inklusive) liegt. */
export async function getActiveFerien(supabase: any): Promise<FerienConfig | null> {
  try {
    const { data } = await supabase.from("website_settings").select("value").eq("key", "ferienmodus").maybeSingle();
    const v = data?.value as Partial<FerienConfig> | undefined;
    if (!v?.von || !v?.bis) return null;
    const today = todayZurich();
    if (today < v.von || today > v.bis) return null;
    return {
      von: v.von,
      bis: v.bis,
      betreff: (v.betreff || "").trim() || DEFAULT_FERIEN_BETREFF,
      text: (v.text || "").trim() || DEFAULT_FERIEN_TEXT,
    };
  } catch (e) {
    console.error("Ferienmodus lesen fehlgeschlagen", e);
    return null;
  }
}

export function buildFerienMail(cfg: FerienConfig, name: string) {
  const vars: Record<string, string> = {
    name: (name || "").trim() || "",
    von: fmt(cfg.von),
    bis: fmt(cfg.bis),
    rueckkehr: fmt(nextDay(cfg.bis)),
  };
  const fill = (s: string) => s.replace(/\{(name|von|bis|rueckkehr)\}/g, (_, k) => vars[k]);
  const text = fill(cfg.text).replace(/Hallo\s*,/g, "Hallo,").replace(/Hallo  /g, "Hallo ");
  const subject = fill(cfg.betreff).replace(/[\r\n]/g, " ");
  const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; color: #111827;">
      <div style="background: #FF5A00; padding: 20px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 18px; font-weight: 600;">3DMuscio – Ferien</h1>
      </div>
      <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: 0; border-radius: 0 0 12px 12px; white-space: pre-wrap; line-height: 1.5;">${esc(text)}</div>
      <p style="text-align:center; font-size: 12px; color: #6b7280; margin-top: 12px;">Dies ist eine automatische Antwort.</p>
    </div>`;
  return { subject, text, html };
}
