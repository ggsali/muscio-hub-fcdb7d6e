import type { Mass3 } from "@/lib/versandArt";

/** Aufwand fuer das Entfernen von Stuetzen: Grundaufwand plus Minuten pro Gramm Stuetzmaterial (nach oben begrenzt). */
export interface StuetzenParams { grundMin: number; minProG: number; maxMin: number }
export const STUETZEN_STANDARD: StuetzenParams = { grundMin: 6, minProG: 0.4, maxMin: 40 };
export function stuetzenMin(supportGrams: number | null | undefined, p: StuetzenParams = STUETZEN_STANDARD): number {
  const g = Math.max(0, Number(supportGrams) || 0);
  return p.grundMin + Math.min(p.maxMin, p.minProG * g);
}

/** Geschätzte Nachbearbeitung pro Stück in Minuten aus Stützstrukturen, Grösse, Dreiecksanzahl (Detailreichtum) und Füllgrad der Hülle.
 *  Bewusst eher grosszügig (+50 %). */
export function schaetzeNachbearbeitungMin(i: {
  hasSupport: boolean;
  dims: Mass3 | null;
  triangles?: number | null;
  volumeCm3?: number | null;
  /** Gewicht des Stuetzmaterials (g) aus dem Slicer. Fehlt es, gilt die grobe Schaetzung nach Teilegroesse. */
  supportGrams?: number | null;
  stuetzen?: StuetzenParams;
}): number {
  let min = 5; // Entnehmen, Brim/Kanten entfernen, Sichtkontrolle
  const maxDim = i.dims ? Math.max(...i.dims) : 0;
  // Stützstrukturen entfernen: Grundaufwand, bei grossen Teilen mehr Fläche
  if (i.hasSupport) {
    min += i.supportGrams != null && i.supportGrams > 0 ? stuetzenMin(i.supportGrams, i.stuetzen) : 10 + Math.min(12, maxDim / 20);
  }
  // Detailreiche Modelle (viele Dreiecke) brauchen mehr Putzen/Entgraten
  const tri = i.triangles ?? 0;
  if (tri >= 300_000) min += 6;
  else if (tri >= 100_000) min += 4;
  else if (tri >= 30_000) min += 2;
  // Filigrane / hohle Formen (kleines Volumen im Verhältnis zum Bauraum): mehr Handarbeit
  if (i.dims && i.volumeCm3 && i.volumeCm3 > 0) {
    const box = (i.dims[0] * i.dims[1] * i.dims[2]) / 1000; // cm³
    if (box > 0) {
      const fuell = i.volumeCm3 / box;
      if (fuell < 0.15) min += 5;
      else if (fuell < 0.3) min += 3;
      else if (fuell < 0.5) min += 2;
    }
  }
  return Math.min(90, Math.round(min * 1.5 * 10) / 10);
}
