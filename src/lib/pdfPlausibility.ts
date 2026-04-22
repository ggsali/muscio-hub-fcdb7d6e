import { toast } from "@/hooks/use-toast";
import { formatCHF } from "./calc";

interface PlausibilityPart {
  preis_total: number;
}

interface PlausibilityCheckInput {
  parts: PlausibilityPart[];
  expressKosten?: number;
  umsatz_total: number;
  /** Kontext für die Warnung, z.B. "Rechnung", "Offerte", "Akontorechnung" */
  context?: string;
  /** Toleranz in CHF (Rundungsfehler abfangen). Default: 0.05 */
  tolerance?: number;
}

export interface PlausibilityResult {
  ok: boolean;
  expected: number;
  actual: number;
  diff: number;
}

/**
 * Validiert, dass die Summe der Teile/Positionen + Express dem Auftrag-Totalumsatz entspricht.
 * Zeigt bei Abweichung eine Toast-Warnung an und gibt das Ergebnis zurück.
 */
export function checkPdfPlausibility(input: PlausibilityCheckInput): PlausibilityResult {
  const tolerance = input.tolerance ?? 0.05;
  const partsSum = input.parts.reduce((s, p) => s + (Number(p.preis_total) || 0), 0);
  const express = Number(input.expressKosten) || 0;
  const expected = partsSum + express;
  const actual = Number(input.umsatz_total) || 0;
  const diff = Math.abs(expected - actual);
  const ok = diff <= tolerance;

  if (!ok) {
    const ctx = input.context ? ` (${input.context})` : "";
    toast({
      variant: "destructive",
      title: `Plausibilitäts-Warnung${ctx}`,
      description:
        `Summe der Positionen (${formatCHF(expected)}) weicht vom Totalumsatz (${formatCHF(actual)}) um ${formatCHF(diff)} ab. ` +
        `Bitte prüfen Sie die Teile-/Positionspreise.`,
    });
    // Auch in der Konsole loggen für Debugging
    console.warn("[PDF Plausibility]", { context: input.context, expected, actual, diff, partsSum, express });
  }

  return { ok, expected, actual, diff };
}
