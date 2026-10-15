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
  // Gleiches Layout wie die übrigen Kunden-Mails (send-email): dunkler Kopf mit Logo, weisse Karte, Footer
  const BRAND = "#00cc66";
  const paras = esc(text).split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px;">${p.replace(/\n/g, "<br>")}</p>`).join("");
  const html = `<!doctype html><html><body style="margin:0;padding:24px 0;background:#f4f4f5;font-family:Inter,-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;color:#1a1a1a;">
  <div style="max-width:600px;margin:0 auto;padding:0 16px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background:#18181b;padding:20px 28px;border-radius:12px 12px 0 0;width:100%;border-collapse:separate;">
      <tr>
        <td width="48" style="vertical-align:middle;padding-right:14px;">
          <img src="https://ukqtjdsjmtxgzhklvqky.supabase.co/storage/v1/object/public/company-assets/logo.jpeg" alt="3DMuscio" width="48" height="48" style="border-radius:8px;display:block;" />
        </td>
        <td style="vertical-align:middle;">
          <div style="color:#ffffff;font-size:20px;font-weight:700;line-height:24px;">3DMuscio</div>
          <div style="color:${BRAND};font-size:12px;font-weight:600;line-height:16px;">3D-Druck Schweiz</div>
        </td>
        <td align="right" style="vertical-align:middle;font-size:26px;">🏖️</td>
      </tr>
    </table>
    <div style="background:#ffffff;padding:32px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;line-height:1.6;font-size:14px;">
      <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#18181b;">Wir sind in den Ferien</h1>
      <div style="background:#ecfdf3;border:1px solid ${BRAND};border-radius:10px;padding:16px 20px;margin:0 0 20px;">
        <p style="margin:0 0 4px;font-size:12px;color:#047857;font-weight:700;text-transform:uppercase;">Ferien</p>
        <p style="margin:0;font-size:18px;font-weight:700;">${esc(vars.von)} – ${esc(vars.bis)}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#374151;">Wir melden uns ab dem ${esc(vars.rueckkehr)} bei dir.</p>
      </div>
      ${paras}
    </div>
    <div style="text-align:center;font-size:12px;color:#9ca3af;padding:20px 8px 0;">
      <p style="margin:0 0 4px;">Dies ist eine automatische Antwort.</p>
      <p style="margin:0 0 4px;">3DMuscio · Eschlikon TG</p>
      <p style="margin:0;">
        <a href="mailto:info@3dmuscio.com" style="color:#9ca3af;text-decoration:none;">info@3dmuscio.com</a>
        &nbsp;·&nbsp; +41 77 804 41 22 &nbsp;·&nbsp;
        <a href="https://3dmuscio.com" style="color:#9ca3af;text-decoration:none;">www.3dmuscio.com</a>
      </p>
    </div>
  </div>
</body></html>`;
  return { subject, text, html };
}
