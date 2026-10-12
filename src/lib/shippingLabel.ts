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

function base64ToPdfUrl(base64: string): string {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
}

function downloadPdf(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "versandetikette.pdf";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Öffnet den Druckdialog direkt mit der Etikette (unsichtbarer Frame).
 * Im Dialog den Etikettendrucker (z. B. Vretti 4x6) wählen; die Auswahl merkt sich der Browser.
 * Klappt das nicht (z. B. Safari), wird das PDF in einem neuen Tab geöffnet.
 */
function printPdf(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const frame = document.createElement("iframe");
      frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
      frame.src = url;
      frame.onload = () => {
        setTimeout(() => {
          try {
            frame.contentWindow?.focus();
            frame.contentWindow?.print();
            resolve(true);
          } catch {
            resolve(false);
          }
          setTimeout(() => frame.remove(), 60_000);
        }, 400);
      };
      document.body.appendChild(frame);
    } catch {
      resolve(false);
    }
  });
}

/** Erstellt die Post-Versandetikette für einen Auftrag und öffnet direkt den Druckdialog. */
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

    const url = base64ToPdfUrl(data.label_base64);
    const printed = await printPdf(url);
    if (!printed) {
      // Fallback: im neuen Tab öffnen, sonst herunterladen
      if (!window.open(url, "_blank")) downloadPdf(url, data.filename);
    }
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
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
