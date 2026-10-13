// Browser-safe shared config + pricing for the city model configurator.
// Keep in sync with supabase/functions/create-stadtmodell-checkout/index.ts.
export const MASSSTAEBE = [500, 1000, 2000, 2500] as const;
export const MATERIALIEN = {
  pla_weiss: { label: "PLA Weiss matt", faktor: 1 },
  pla_grau: { label: "PLA Grau", faktor: 1 },
  pla_stein: { label: "PLA Stein-Look", faktor: 1.25 },
} as const;
export type MaterialKey = keyof typeof MATERIALIEN;
export const KANTE_MIN = 100;
export const KANTE_MAX = 500;
export const SOCKEL_MIN = 2;
export const SOCKEL_MAX = 15;
export const MODELL_MIN_MM = 40;
export const MODELL_MAX_MM = 250;
export const QUELLE = "Quelle: swisstopo (swissALTI3D) · Gebäude © OpenStreetMap-Mitwirkende";

export function modellMm(kanteM: number, massstab: number) {
  return Math.round((kanteM * 1000) / massstab);
}

export function berechnePreis(kanteM: number, massstab: number, sockelMm: number, material: MaterialKey) {
  const mm = modellMm(kanteM, massstab);
  const f = MATERIALIEN[material].faktor;
  const p = 29 + (mm / 10) ** 2 * 0.3 * f + ((sockelMm * mm * mm) / 1000) * 0.02;
  return Math.round(p * 2) / 2;
}
