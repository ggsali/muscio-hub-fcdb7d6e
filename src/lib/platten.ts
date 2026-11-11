/** Schnelle Schätzung, auf wie vielen Druckplatten N Stück eines Teils Platz haben (ohne Slicer, sofort).
 *  Der Server slict die Menge nach dem Absenden genau; die echte Plattenzahl ersetzt dann diese Schätzung im Auftrag. */
export type Mass3 = [number, number, number];

/** Nutzbare Druckbetten (Breite = Tiefe, Höhe) in mm, kleinster Drucker zuerst */
export const BETTEN: { name: string; bed: number; h: number }[] = [
  { name: "A1", bed: 256, h: 256 },
  { name: "K2 Plus", bed: 350, h: 350 },
  { name: "XL", bed: 420, h: 420 },
];
const RAND = 10; // mm Rand rundum
const ABSTAND = 6; // mm zwischen den Teilen

function proPlatte(dims: Mass3, bed: number, hoehe: number): number {
  let best = 0;
  // wie modelliert oder flach auf der grössten Seite (nie hochkant: instabil)
  const flach = [...dims].sort((x, y) => y - x) as Mass3;
  const perms: Mass3[] = [dims, flach];

  const nutz = bed - 2 * RAND;
  for (const [w, d, h] of perms) {
    if (h > hoehe || w > nutz || d > nutz) continue;
    // beide Drehungen in der Ebene
    for (const [a, b] of [[w, d], [d, w]]) {
      const n = Math.floor((nutz + ABSTAND) / (a + ABSTAND)) * Math.floor((nutz + ABSTAND) / (b + ABSTAND));
      if (n > best) best = n;
    }
  }
  return best;
}

/** Anzahl Platten für `menge` Stück; bei Teilen ohne Masse oder zu gross für jeden Drucker: 1 Platte pro Stück (geteilt gedruckt) bzw. 1 */
export function schaetzePlatten(dims: Mass3 | null | undefined, menge: number): { plates: number; printer?: string } {
  const n = Math.max(1, Math.floor(menge));
  if (!dims || !dims.every((v) => Number.isFinite(v) && v > 0)) return { plates: 1 };
  let best: { plates: number; printer?: string } | null = null;
  for (const b of BETTEN) {
    const pp = proPlatte(dims, b.bed, b.h);
    if (pp < 1) continue;
    const plates = Math.ceil(n / pp);
    if (!best || plates < best.plates) best = { plates, printer: b.name }; // Gleichstand: kleinerer Drucker
  }
  return best ?? { plates: n };
}
