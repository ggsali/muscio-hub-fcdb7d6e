// Browser-safe shared config + pricing for the city model configurator.
// Pricing is recomputed server-side in stadtmodell.functions.ts.
export const MASSSTAEBE = [500, 1000, 2000, 2500] as const;
export const KANTE_MIN = 100;
export const KANTE_MAX = 500;
export const SOCKEL_MIN = 2;
export const SOCKEL_MAX = 15;
export const MODELL_MIN_MM = 40;
export const MODELL_MAX_MM = 250;
export const QUELLE = "Quelle: swisstopo (swissALTI3D) · Gebäude © OpenStreetMap-Mitwirkende";

export const VERSAND = {
  b_post: { label: "PostPac Economy (B-Post)", info: "2–3 Werktage", preis: 8.5 },
  a_post: { label: "PostPac Priority (A-Post)", info: "1 Werktag", preis: 11.5 },
} as const;
export type VersandKey = keyof typeof VERSAND;

export interface StadtmodellFilament {
  id: string;
  name: string;
  material: string;
  hersteller: string | null;
  hex: string;
  farbname: string;
}

export function modellMm(kanteM: number, massstab: number) {
  return Math.round((kanteM * 1000) / massstab);
}

export function berechnePreis(kanteM: number, massstab: number, sockelMm: number) {
  const mm = modellMm(kanteM, massstab);
  const p = 29 + (mm / 10) ** 2 * 0.3 + ((sockelMm * mm * mm) / 1000) * 0.02;
  return Math.round(p * 2) / 2;
}

/** Rough print-time estimate in hours (display only). */
export function druckzeitH(kanteM: number, massstab: number, sockelMm: number) {
  const mm = modellMm(kanteM, massstab);
  return Math.max(2, Math.round(((mm * mm * (sockelMm + 6)) / 1000 / 12) * 10) / 10);
}
