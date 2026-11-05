import { describe, expect, it } from "vitest";
import { buildBubble, toBinaryStl } from "./bubbleLetters";

function maske(W: number, H: number, f: (x: number, y: number) => boolean) {
  const m = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) m[y * W + x] = f(x, y) ? 1 : 0;
  return m;
}
// Jede Kante muss von genau zwei Dreiecken in entgegengesetzter Richtung benutzt werden (wasserdicht)
function wasserdicht(index: Uint32Array[]) {
  const e = new Map<string, number>();
  for (const ix of index) for (let t = 0; t < ix.length; t += 3) for (let k = 0; k < 3; k++) {
    const a = ix[t + k], b = ix[t + (k + 1) % 3];
    e.set(`${a}>${b}`, (e.get(`${a}>${b}`) ?? 0) + 1);
  }
  let schlecht = 0;
  for (const [key, n] of e) {
    const [a, b] = key.split(">");
    if (n !== 1 || e.get(`${b}>${a}`) !== 1) schlecht++;
  }
  return schlecht;
}
const o = { hoehe: 10, radius: 8, fuelle: 2, weich: 0, beidseitig: false };

describe("buildBubble", () => {
  it("Rechteck: wasserdicht, Volumen > 0, Höhe passt", () => {
    const m = maske(80, 50, (x, y) => x >= 5 && x < 75 && y >= 5 && y < 45);
    const r = buildBubble(m, 80, 50, 2, o)!;
    expect(wasserdicht(r.parts.map((p) => p.index))).toBe(0);
    expect(r.volume).toBeGreaterThan(1000);
    expect(r.dims.z).toBeGreaterThan(9);
    expect(r.dims.z).toBeLessThanOrEqual(10.01);
    expect(r.parts.length).toBe(1);
  });
  it("Ring mit Loch und zwei getrennte Teile", () => {
    const m = maske(120, 60, (x, y) => {
      const ring = Math.hypot(x - 30, y - 30) < 22 && Math.hypot(x - 30, y - 30) > 9;
      const kasten = x >= 70 && x < 110 && y >= 15 && y < 45;
      return ring || kasten;
    });
    const r = buildBubble(m, 120, 60, 2, { ...o, weich: 1 })!;
    expect(r.parts.length).toBe(2);
    expect(wasserdicht(r.parts.map((p) => p.index))).toBe(0);
    expect(r.parts[0].x0).toBeLessThan(r.parts[1].x0);
  });
  it("Beidseitig: doppelte Höhe, immer noch wasserdicht", () => {
    const m = maske(60, 40, (x, y) => x >= 4 && x < 56 && y >= 4 && y < 36);
    const r = buildBubble(m, 60, 40, 2, { ...o, beidseitig: true })!;
    expect(wasserdicht(r.parts.map((p) => p.index))).toBe(0);
    expect(r.dims.z).toBeGreaterThan(18);
  });
  it("STL hat die richtige Grösse", () => {
    const m = maske(40, 30, (x, y) => x >= 3 && x < 37 && y >= 3 && y < 27);
    const r = buildBubble(m, 40, 30, 2, o)!;
    expect(toBinaryStl(r.positions, r.parts.map((p) => p.index)).byteLength).toBe(84 + r.triangles * 50);
  });
});
