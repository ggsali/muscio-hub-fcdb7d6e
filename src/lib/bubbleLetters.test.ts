import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { layoutText, mapChar, parseGlyphs, sanitizeText, toBinaryStl, DEFAULTS } from "./bubbleLetters";

const raw = readFileSync("public/fonts/ceramic-alphabet.bin");
const glyphs = parseGlyphs(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer);

// Jede Kante muss von genau zwei Dreiecken in entgegengesetzter Richtung benutzt werden (wasserdicht)
function offeneKanten(index: Uint32Array[]) {
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

describe("Buchstaben-Vorlagen", () => {
  it("alle 26 Buchstaben vorhanden, flache Rückseite bei z=0, Unterkante y=0", () => {
    expect([...glyphs.keys()].sort().join("")).toBe("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
    for (const g of glyphs.values()) {
      let mz = Infinity, my = Infinity;
      for (let i = 0; i < g.positions.length; i += 3) { mz = Math.min(mz, g.positions[i + 2]); my = Math.min(my, g.positions[i + 1]); }
      expect(Math.abs(mz)).toBeLessThan(0.01);
      expect(Math.abs(my)).toBeLessThan(0.01);
    }
  });
  it("Masse entsprechen den Originaldateien (A = 74.08 × 78.13 × 19.0 mm)", () => {
    const a = glyphs.get("A")!;
    expect(a.w).toBeCloseTo(74.08, 1);
    expect(a.h).toBeCloseTo(78.13, 1);
    expect(a.d).toBeCloseTo(19.0, 1);
  });
  it("Buchstaben sind wasserdicht", () => {
    for (const g of glyphs.values()) expect(offeneKanten([g.index]), g.ch).toBe(0);
  });
});

describe("layoutText", () => {
  it("setzt Text zusammen und skaliert auf die gewünschte Höhe", () => {
    const r = layoutText(glyphs, { ...DEFAULTS, text: "NORA", size: 40 })!;
    expect(r.parts.map((p) => p.ch).join("")).toBe("NORA");
    expect(r.dims.y).toBeGreaterThan(36);
    expect(r.dims.y).toBeLessThan(44);
    expect(r.volume).toBeGreaterThan(1000);
    expect(offeneKanten(r.parts.map((p) => p.index))).toBe(0);
  });
  it("alle Buchstaben gleich hoch", () => {
    for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
      const r = layoutText(glyphs, { ...DEFAULTS, text: ch, size: 50 })!;
      expect(r.dims.y, ch).toBeCloseTo(50, 1);
    }
  });
  it("alle Buchstaben gleich dick", () => {
    for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
      const r = layoutText(glyphs, { ...DEFAULTS, text: ch, size: 100 })!;
      expect(r.dims.z, ch).toBeCloseTo(24.5, 0);
    }
  });
  it("mehrere Zeilen sind höher; Leerzeichen erzeugt keine Teile", () => {
    const a = layoutText(glyphs, { ...DEFAULTS, text: "AB" })!;
    const b = layoutText(glyphs, { ...DEFAULTS, text: "A B\nCD" })!;
    expect(b.parts.length).toBe(4);
    expect(b.dims.y).toBeGreaterThan(a.dims.y * 1.8);
  });
  it("Kleinbuchstaben werden gross, Umlaute umgewandelt, Unbekanntes gemeldet", () => {
    expect(mapChar("a")).toBe("A");
    expect(mapChar("ä")).toBe("A");
    expect(mapChar("5")).toBeNull();
    const r = layoutText(glyphs, { ...DEFAULTS, text: "aä5!" })!;
    expect(r.parts.map((p) => p.ch).join("")).toBe("AA");
    expect(r.warnings.length).toBe(2);
  });
  it("nur Unbekanntes ergibt kein Ergebnis", () => {
    expect(layoutText(glyphs, { ...DEFAULTS, text: "123" })).toBeNull();
  });
  it("Abstand vergrössert die Breite", () => {
    const a = layoutText(glyphs, { ...DEFAULTS, text: "AAA", spacing: 0 })!;
    const b = layoutText(glyphs, { ...DEFAULTS, text: "AAA", spacing: 10 })!;
    expect(b.dims.x - a.dims.x).toBeCloseTo(20, 0);
  });
  it("sanitizeText begrenzt Zeilen und Länge", () => {
    expect(sanitizeText("a\nb\nc\nd\ne").split("\n").length).toBe(4);
    expect(sanitizeText("x".repeat(30)).length).toBe(20);
  });
});

describe("toBinaryStl", () => {
  it("Länge = 84 + 50 pro Dreieck", () => {
    const r = layoutText(glyphs, { ...DEFAULTS, text: "I" })!;
    expect(toBinaryStl(r.positions, r.parts.map((p) => p.index)).byteLength).toBe(84 + 50 * r.triangles);
  });
});
