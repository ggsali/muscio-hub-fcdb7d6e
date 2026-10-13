import { supabase } from "@/integrations/supabase/client";
import { normalizeStreet } from "@/lib/address";

/** Etikettenformat des Filament-Etikettendruckers (Endlospapier 50 × 30 mm) */
const LABEL_W_MM = 50;
const LABEL_H_MM = 30;

export interface AddressLabelResult {
  ok: boolean;
  error?: string;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Land nur anzeigen, wenn es nicht die Schweiz ist */
const isSwiss = (land?: string | null) => {
  const l = String(land || "").trim().toLowerCase();
  return !l || ["ch", "schweiz", "suisse", "svizzera", "switzerland"].includes(l);
};

/**
 * Druckt eine Adressetikette (Briefpost) für den Auftrag auf dem Etikettendrucker (50 × 30 mm).
 * Ohne Post-API – bei Briefen gibt es keine Sendungsnummer.
 */
export async function printAddressLabel(orderId: string | null, customerId?: string): Promise<AddressLabelResult> {
  try {
    let custId = customerId;
    if (orderId) {
      const { data: order, error: oErr } = await supabase
        .from("orders").select("customer_id").eq("id", orderId).single();
      if (oErr || !order?.customer_id) return { ok: false, error: "Auftrag oder Kunde nicht gefunden" };
      custId = order.customer_id;
    }
    if (!custId) return { ok: false, error: "Kunde nicht gefunden" };

    const { data: c, error: cErr } = await supabase
      .from("customers")
      .select("name, vorname, firma, strasse, hausnummer, plz, ort, land")
      .eq("id", custId).single();
    if (cErr || !c) return { ok: false, error: "Kunde nicht gefunden" };

    const addr = normalizeStreet(c.strasse, c.hausnummer);
    const strasse = [addr.strasse, addr.hausnummer].filter(Boolean).join(" ").trim();
    const plzOrt = `${String(c.plz || "").trim()} ${String(c.ort || "").trim()}`.trim();
    const person = `${c.vorname || ""} ${c.name || ""}`.trim();
    if (!strasse || !plzOrt) {
      return { ok: false, error: "Empfänger: Strasse, PLZ oder Ort fehlt im Kundenprofil." };
    }

    // Absender (klein oben), aus den Firmeneinstellungen
    const { data: rows } = await supabase.from("company_settings").select("key,value");
    const comp: Record<string, string> = {};
    (rows || []).forEach((r: any) => { comp[r.key] = r.value; });
    const absender = [comp.firmenname || "3dMuscio", String(comp.adresse || "").replace(/\s*\n\s*/g, ", ")]
      .filter(Boolean).join(" · ");

    const lines = [
      c.firma || person,
      c.firma ? person : "",
      strasse,
      plzOrt,
      isSwiss(c.land) ? "" : String(c.land).toUpperCase(),
    ].filter(Boolean);

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Adressetikette</title>
<style>
  @page { size: ${LABEL_W_MM}mm ${LABEL_H_MM}mm; margin: 0; }
  html, body { margin: 0; padding: 0; }
  .l { width: ${LABEL_W_MM}mm; height: ${LABEL_H_MM}mm; box-sizing: border-box; padding: 1.5mm 2mm;
       font-family: Arial, Helvetica, sans-serif; color: #000; overflow: hidden; }
  .abs { font-size: 6pt; color: #333; border-bottom: 0.2mm solid #000; padding-bottom: 0.4mm; margin-bottom: 1mm;
         white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .adr { font-size: 12pt; line-height: 1.15; font-weight: 600; }
  .adr div { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style></head><body>
<div class="l"><div class="abs">${esc(absender)}</div>
<div class="adr">${lines.map((t) => `<div>${esc(t)}</div>`).join("")}</div></div>
</body></html>`;

    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    frame.srcdoc = html;
    frame.onload = () => {
      setTimeout(() => {
        try { frame.contentWindow?.focus(); frame.contentWindow?.print(); } catch { /* ignore */ }
        setTimeout(() => frame.remove(), 60_000);
      }, 300);
    };
    document.body.appendChild(frame);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}
