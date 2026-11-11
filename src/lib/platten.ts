/** Schnelle Schätzung, auf wie vielen Druckplatten N Stück eines Teils Platz haben (ohne Slicer, sofort).
 *  Mehrere Stück werden auf der Platte des H2C angeordnet (330 x 320 mm); passt das Teil dort nicht, gilt der XL.
 *  Der Server slict die Menge nach dem Absenden genau; die echte Plattenzahl ersetzt dann diese Schätzung im Auftrag. */
export type Mass3 = [number, number, number];

export const BETTEN: { name: string; w: number; d: number; h: number }[] = [
  { name: "H2C", w: 330, d: 320, h: 325 },
  { name: "XL", w: 420, d: 420, h: 420 },
];
const RAND = 10; // mm Rand rundum
const ABSTAND = 6; // mm zwischen den Teilen

function proPlatte(dims: Mass3, bw: number, bd: number, hoehe: number): number {
  // wie modelliert oder flach auf der grössten Seite (nie hochkant: instabil)
  const flach = [...dims].sort((x, y) => y - x) as Mass3;
  const nw = bw - 2 * RAND, nd = bd - 2 * RAND;
  let best = 0;
  for (const [w, d, h] of [dims, flach]) {
    if (h > hoehe) continue;
    for (const [a, b] of [[w, d], [d, w]]) {
      if (a > nw || b > nd) continue;
      const n = Math.floor((nw + ABSTAND) / (a + ABSTAND)) * Math.floor((nd + ABSTAND) / (b + ABSTAND));
      if (n > best) best = n;
    }
  }
  return best;
}

/** Anzahl Platten für `menge` Stück; ohne Masse: 1; zu gross für jeden Drucker: 1 Platte pro Stück (geteilt gedruckt) */
export function schaetzePlatten(dims: Mass3 | null | undefined, menge: number): { plates: number; printer?: string } {
  const n = Math.max(1, Math.floor(menge));
  if (!dims || !dims.every((v) => Number.isFinite(v) && v > 0)) return { plates: 1 };
  for (const b of BETTEN) {
    const pp = proPlatte(dims, b.w, b.d, b.h);
    if (pp >= 1) return { plates: Math.ceil(n / pp), printer: b.name };
  }
  return { plates: n };
}
