import { supabase } from "@/integrations/supabase/client";

export interface ShippingLabelResult {
  ok: boolean;
  /** Verständliche Fehlermeldung (bei ok=false) */
  error?: string;
  /** Zugangsdaten fehlen -> Einstellungen öffnen */
  notConfigured?: boolean;
  /** Sendungsnummer aus der Antwort der Post (nur im echten Modus) */
  trackingNr?: string | null;
  /** true, wenn die Nummer serverseitig im Auftrag gespeichert wurde */
  trackingSaved?: boolean;
  /** Testmodus: SPECIMEN-Etikette, nicht versandgültig */
  testMode?: boolean;
}

function downloadBase64Pdf(base64: string, filename: string) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "versandetikette.pdf";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Erstellt die Post-Versandetikette für einen Auftrag und lädt das PDF herunter. */
export async function createShippingLabel(orderId: string): Promise<ShippingLabelResult> {
  try {
    const { data, error } = await supabase.functions.invoke("generate-shipping-label", {
      body: { order_id: orderId },
    });

    if (error || !data?.success) {
      // Bei HTTP 400 steckt die eigentliche Meldung im Body der Antwort
      let msg: string = data?.error || "";
      if (!msg && (error as any)?.context?.json) {
        try { msg = (await (error as any).context.json())?.error || ""; } catch { /* ignore */ }
      }
      msg = msg || error?.message || "Unbekannter Fehler";
      return { ok: false, error: msg, notConfigured: /not configured/i.test(msg) };
    }

    downloadBase64Pdf(data.label_base64, data.filename);
    return {
      ok: true,
      trackingNr: data.tracking_nr ?? null,
      trackingSaved: !!data.tracking_saved,
      testMode: !!data.test_mode,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}
