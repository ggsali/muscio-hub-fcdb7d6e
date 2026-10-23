import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import type { SpardoseResult } from "@/lib/spardose";

// Ordnet die Einzelteile (Körper, Buchstaben, Kappe) nebeneinander auf einer Platte des grossen Druckers an.
export const PLATE = { x: 420, y: 420, z: 420, gap: 6, margin: 8 };

type Item = { g: THREE.BufferGeometry; w: number; h: number; name: string };

function prep(res: SpardoseResult): THREE.BufferGeometry[] {
  const body = res.body.clone();
  const letters = res.letters.clone();
  letters.rotateX(Math.PI); // flache Rückseite nach unten
  const cap = res.cap.clone();
  return [body, letters, cap];
}

function pack(items: Item[]): { pos: [number, number][]; ok: boolean } {
  const sorted = items.map((it, i) => ({ it, i })).sort((a, b) => b.it.h - a.it.h);
  const pos: [number, number][] = items.map(() => [0, 0]);
  const maxX = PLATE.x - PLATE.margin, maxY = PLATE.y - PLATE.margin;
  let x = PLATE.margin, y = PLATE.margin, rowH = 0, ok = true;
  for (const { it, i } of sorted) {
    if (x + it.w > maxX) { x = PLATE.margin; y += rowH + PLATE.gap; rowH = 0; }
    if (x + it.w > maxX || y + it.h > maxY) ok = false;
    pos[i] = [x, y];
    x += it.w + PLATE.gap;
    rowH = Math.max(rowH, it.h);
  }
  return { pos, ok };
}

export function buildPlate(res: SpardoseResult): { blob: Blob; fits: boolean; info: string } {
  const geos = prep(res);
  const names = ["Körper", "Buchstaben", "Kappe"];
  let best: { geos: THREE.BufferGeometry[]; pos: [number, number][]; ok: boolean; items: Item[] } | null = null;
  for (const rot of [false, true]) {
    const gs = geos.map((g) => { const c = g.clone(); if (rot) c.rotateZ(Math.PI / 2); return c; });
    const items: Item[] = gs.map((g, i) => {
      g.computeBoundingBox();
      const b = g.boundingBox!;
      g.translate(-b.min.x, -b.min.y, -b.min.z);
      return { g, w: b.max.x - b.min.x, h: b.max.y - b.min.y, name: names[i] };
    });
    const r = pack(items);
    if (!best || (r.ok && !best.ok)) best = { geos: gs, pos: r.pos, ok: r.ok, items };
    if (r.ok) break;
  }
  const b = best!;
  const group = new THREE.Group();
  b.items.forEach((it, i) => {
    const m = new THREE.Mesh(it.g);
    m.position.set(b.pos[i][0], b.pos[i][1], 0);
    group.add(m);
  });
  group.updateMatrixWorld(true);
  const dv = new STLExporter().parse(group, { binary: true }) as unknown as DataView;
  const blob = new Blob([dv.buffer as ArrayBuffer], { type: "model/stl" });
  const tooTall = b.items.some((it) => { it.g.computeBoundingBox(); return it.g.boundingBox!.max.z > PLATE.z; });
  geos.forEach((g) => g.dispose());
  b.items.forEach((it) => it.g.dispose());
  const used = b.items.map((it) => `${it.name} ${it.w.toFixed(0)}×${it.h.toFixed(0)}`).join(" · ");
  return { blob, fits: b.ok && !tooTall, info: used };
}
