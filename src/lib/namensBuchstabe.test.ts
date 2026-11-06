import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_BIRTH, NAME_FONTS, LETTER_FONTS, buildBirth, trianglesToStl, type FontLoader } from "./namensBuchstabe";

const loader: FontLoader = async (f) => { const b = readFileSync(`public/fonts/geburt/${f}`); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; };

describe("Namensbuchstabe", () => {
  it("baut Buchstabe, Name und Icons mit Mulden", async () => {
    const r = (await buildBirth(DEFAULT_BIRTH, loader))!;
    const ids = r.parts.map((p) => p.id);
    expect(ids).toContain("buchstabe");
    expect(ids).toContain("name");
    expect(ids).toContain("uhr-platte");
    expect(ids).toContain("ballon-relief");
    const l = r.parts.find((p) => p.id === "buchstabe")!;
    expect(l.dims.y).toBeGreaterThan(140);
    expect(l.dims.z).toBeCloseTo(30, 1);
    expect(l.volume).toBeGreaterThan(20000);
    // Mulde: Buchstabe mit Mulden ist leichter als ohne
    const ohne = (await buildBirth({ ...DEFAULT_BIRTH, name: "", icons: { ...DEFAULT_BIRTH.icons, uhr: { ...DEFAULT_BIRTH.icons.uhr, enabled: false }, ballon: { ...DEFAULT_BIRTH.icons.ballon, enabled: false }, body: { ...DEFAULT_BIRTH.icons.body, enabled: false }, gewicht: { ...DEFAULT_BIRTH.icons.gewicht, enabled: false } } }, loader))!;
    expect(ohne.parts.find((p) => p.id === "buchstabe")!.volume).toBeGreaterThan(l.volume + 500);
    const stl = trianglesToStl(l.positions);
    expect(stl.byteLength).toBe(84 + 50 * (l.positions.length / 9));
  }, 60000);
  it("alle Schriften liefern Polygone", async () => {
    for (const f of NAME_FONTS) {
      const r = await buildBirth({ ...DEFAULT_BIRTH, nameFont: f.id, name: "Marco" }, loader);
      expect(r?.parts.some((p) => p.id === "name"), f.id).toBe(true);
    }
    for (const f of LETTER_FONTS) {
      const r = await buildBirth({ ...DEFAULT_BIRTH, letterFont: f.id, letter: "S" }, loader);
      expect(r?.parts[0].dims.y, f.id).toBeGreaterThan(100);
    }
  }, 120000);
});
