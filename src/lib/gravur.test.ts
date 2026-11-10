import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { DEFAULT_PLACE, engrave, faceRegion, prepareImage, toStl, to3mf, triangles, volume } from "./gravur";

function ringImage(inv = false) {
  const w = 100, h = 100, data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const r = Math.hypot(x + 0.5 - 50, y + 0.5 - 50);
    // weicher Rand (Antialiasing)
    const cov = Math.min(1, Math.max(0, Math.min(30 - r, r - 15) + 0.5));
    const v = Math.round(255 * (inv ? cov : 1 - cov));
    data.set([v, v, v, 255], (y * w + x) * 4);
  }
  return { data, width: w, height: h };
}

function puck() {
  const g = new THREE.CylinderGeometry(40, 40, 10, 96);
  g.rotateX(Math.PI / 2); // Achse = Z, Deckel bei z = +5
  return g.toNonIndexed();
}

describe("Bild zu Vektor", () => {
  it("Ring: ein Loch, Fläche stimmt, auch invertiert (hell auf dunkel)", () => {
    for (const inv of [false, true]) {
      const p = prepareImage(ringImage(inv));
      expect(p.shapes.length).toBe(1);
      expect(p.shapes[0].holes.length).toBe(1);
      const area = THREE.ShapeUtils.area(p.shapes[0].getPoints()) ;
      const hole = THREE.ShapeUtils.area(p.shapes[0].holes[0].getPoints());
      expect(Math.abs(Math.abs(area) - Math.abs(hole))).toBeGreaterThan(2000);
      expect(Math.abs(Math.abs(area) - Math.abs(hole))).toBeLessThan(2250); // pi*(900-225) = 2120
    }
  });
});

describe("Gravur", () => {
  it("findet die Deckelfläche und schneidet exakt", () => {
    const g = puck();
    const pos = g.getAttribute("position");
    let tri = -1;
    for (let i = 0; i < pos.count / 3 && tri < 0; i++) if (pos.getZ(i * 3) > 4.99 && pos.getZ(i * 3 + 1) > 4.99 && pos.getZ(i * 3 + 2) > 4.99) tri = i;
    const f = faceRegion(g, tri)!;
    expect(f.normal.z).toBeCloseTo(1, 3);
    expect(f.size.w).toBeGreaterThan(79);
    expect(f.tris.length).toBeGreaterThan(90);
    const prep = prepareImage(ringImage());
    const t0 = performance.now();
    const r = engrave(g, prep, { ...DEFAULT_PLACE, widthMm: 50, depth: 1 }, f.frame)!;
    console.log("csg ms", Math.round(performance.now() - t0));
    const soll = Math.PI * (900 - 225) * 0.25; // mm2 bei 0.5 mm/px
    expect(r.volEinlage).toBeGreaterThan(soll * 0.97);
    expect(r.volEinlage).toBeLessThan(soll * 1.03);
    // Modell minus Einlage = Original, ohne Spiel
    expect(volume(g) - r.volModell).toBeCloseTo(r.volEinlage, 0);
    // Oberkante der Einlage bleibt auf der Fläche (z = 5), Unterkante bei z = 4
    const b = new THREE.Box3().setFromBufferAttribute(r.einlage.getAttribute("position") as THREE.BufferAttribute);
    expect(b.max.z).toBeCloseTo(5, 3);
    expect(b.min.z).toBeCloseTo(4, 3);
    expect(toStl(r.modell).byteLength).toBe(84 + 50 * (triangles(r.modell).length / 9));
  });
  it("3MF Baugruppe wird erzeugt", async () => {
    const g = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
    const blob = await to3mf([{ name: "A", geo: g }, { name: "B", geo: g }], "Test");
    expect(blob.size).toBeGreaterThan(300);
  });
});
