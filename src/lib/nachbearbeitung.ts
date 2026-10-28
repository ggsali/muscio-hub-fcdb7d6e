import type { Mass3 } from "@/lib/versandArt";

/** Geschätzte Nachbearbeitung pro Stück in Minuten aus Stützstrukturen, Grösse, Dreiecksanzahl (Detailreichtum) und Füllgrad der Hülle.
 *  Bewusst eher grosszügig (+30 %). */
export function schaetzeNachbearbeitungMin(i: {
  hasSupport: boolean;
  dims: Mass3 | null;
  triangles?: number | null;
  volumeCm3?: number | null;
}): number {
  let min = 2; // Entnehmen, Brim/Kanten entfernen, Sichtkontrolle
  const maxDim = i.dims ? Math.max(...i.dims) : 0;
  // Stützstrukturen entfernen: Grundaufwand, bei grossen Teilen mehr Fläche
  if (i.hasSupport) min += 5 + Math.min(8, maxDim / 30);
  // Detailreiche Modelle (viele Dreiecke) brauchen mehr Putzen/Entgraten
  const tri = i.triangles ?? 0;
  if (tri >= 300_000) min += 3;
  else if (tri >= 100_000) min += 2;
  else if (tri >= 30_000) min += 1;
  // Filigrane / hohle Formen (kleines Volumen im Verhältnis zum Bauraum): mehr Handarbeit
  if (i.dims && i.volumeCm3 && i.volumeCm3 > 0) {
    const box = (i.dims[0] * i.dims[1] * i.dims[2]) / 1000; // cm³
    if (box > 0) {
      const fuell = i.volumeCm3 / box;
      if (fuell < 0.15) min += 3;
      else if (fuell < 0.3) min += 2;
      else if (fuell < 0.5) min += 1;
    }
  }
  return Math.min(45, Math.round(min * 1.3 * 10) / 10);
}
