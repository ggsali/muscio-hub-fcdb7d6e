import { supabase } from "@/integrations/supabase/client";

/** Status -> Mail-Schluessel der Edge Function send-email (ohne Offerte/Versandt: die haben eigene Wege). */
export const STATUS_MAIL_SCHLUESSEL: Record<string, string> = {
  "Bezahlt": "zahlung-bestaetigung",
  "Im Druck": "im_druck",
  "Qualitätsprüfung": "qualitaetspruefung",
};

export const STATUS_MAIL_LABEL: Record<string, string> = {
  "zahlung-bestaetigung": "✉️ Zahlungsbestätigung gesendet",
  im_druck: "✉️ «Im Druck»-Mail gesendet",
  qualitaetspruefung: "✉️ Qualitätsprüfung-Mail gesendet",
};

export interface StatusMailOptions {
  trackingNr?: string | null;
  lieferart?: string | null;
  versandart?: string | null;
  pdfBase64?: string;
  pdfFilename?: string;
}

async function einmalSenden(orderId: string, statusKey: string, o: StatusMailOptions) {
  const { data, error } = await supabase.functions.invoke("send-email", {
    body: {
      kind: "status", orderId, statusKey,
      trackingNr: o.trackingNr ?? null, lieferart: o.lieferart ?? null, versandart: o.versandart ?? null,
      pdfBase64: o.pdfBase64, pdfFilename: o.pdfFilename,
    },
  });
  // invoke wirft bei Fehlern nicht: Fehler und "skipped" selbst auswerten
  if (error) {
    let detail = error.message;
    try { const j = await (error as any).context?.json?.(); if (j?.error) detail = j.error; } catch { /* Body nicht lesbar */ }
    throw new Error(detail);
  }
  if ((data as any)?.error) throw new Error(String((data as any).error));
  if ((data as any)?.skipped) throw new Error(`Keine Mail verschickt (${(data as any).reason || "uebersprungen"})`);
}

/** Schickt die Status-Mail an den Kunden; ein zweiter Versuch faengt Rate-Limits und kurze Netzfehler ab. Wirft bei endgueltigem Fehler. */
export async function sendeStatusMail(orderId: string, statusKey: string, o: StatusMailOptions = {}): Promise<void> {
  try {
    await einmalSenden(orderId, statusKey, o);
  } catch {
    await new Promise((r) => setTimeout(r, 1500));
    await einmalSenden(orderId, statusKey, o);
  }
}
