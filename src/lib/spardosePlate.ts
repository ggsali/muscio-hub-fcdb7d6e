import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import type { SpardoseResult } from "@/lib/spardose";

// Ordnet die Einzelteile auf Platten des grossen Druckers an: gleiche Farbe = gleiche Platte, jede andere Farbe = eigene Platte.
export const PLATE = { x: 420, y: 420, z: 420, gap: 5, margin: 8 };

type Piece = { g: THREE.BufferGeometry; name: string };
type Placed = { g: THREE.BufferGeometry; w: number; h: number; name: string };
export type PlatePlan = { hex: string; label: string; blob: Blob; fits: boolean; count: number; info: string };

/** Trennt eine Geometrie in zusammenhängende Einzelteile (z. B. jeder Buchstabe separat). */
function splitComponents(src: THREE.BufferGeometry): THREE.BufferGeometry[] {
  const g = src.index ? src.toNonIndexed() : src.clone();
  const pos = g.getAttribute("position");
  const tri = pos.count / 3;
  const ids = new Map<string, number>();
  const parent: number[] = [];
  const find = (a: number): number => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  const vid = (i: number) => {
    const k = `${Math.round(pos.getX(i) * 100)},${Math.round(pos.getY(i) * 100)},${Math.round(pos.getZ(i) * 100)}`;
    let v = ids.get(k);
    if (v === undefined) { v = parent.length; parent.push(v); ids.set(k, v); }
    return v;
  };
  const tv: number[] = [];
  for (let t = 0; t < tri; t++) {
    const a = vid(t * 3), b = vid(t * 3 + 1), c = vid(t * 3 + 2);
    tv.push(a);
    parent[find(b)] = find(a);
    parent[find(c)] = find(a);
  }
  const buckets = new Map<number, number[]>();
  for (let t = 0; t < tri; t++) {
    const r = find(tv[t]);
    (buckets.get(r) ?? buckets.set(r, []).get(r)!).push(t);
  }
  const out: THREE.BufferGeometry[] = [];
  for (const tl of buckets.values()) {
    const arr = new Float32Array(tl.length * 9);
    tl.forEach((t, n) => { for (let j = 0; j < 9; j++) arr[n * 9 + j] = (pos.array as ArrayLike<number>)[t * 9 + j]; });
    const part = new THREE.BufferGeometry();
    part.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    out.push(part);
  }
  g.dispose();
  return out;
}

/** MaxRects (Best Short Side Fit) mit 90°-Drehung. */
function pack(items: Placed[]): { pos: { x: number; y: number; rot: boolean }[]; ok: boolean } {
  const W = PLATE.x - 2 * PLATE.margin, H = PLATE.y - 2 * PLATE.margin, gap = PLATE.gap;
  let free = [{ x: 0, y: 0, w: W + gap, h: H + gap }];
  const order = items.map((_, i) => i).sort((a, b) => items[b].w * items[b].h - items[a].w * items[a].h);
  const res: { x: number; y: number; rot: boolean }[] = items.map(() => ({ x: 0, y: 0, rot: false }));
  let ok = true;
  for (const i of order) {
    let best: { x: number; y: number; rot: boolean; s: number; l: number; w: number; h: number } | null = null;
    for (const rot of [false, true]) {
      const w = (rot ? items[i].h : items[i].w) + gap, h = (rot ? items[i].w : items[i].h) + gap;
      for (const f of free) {
        if (w <= f.w && h <= f.h) {
          const s = Math.min(f.w - w, f.h - h), l = Math.max(f.w - w, f.h - h);
          if (!best || s < best.s || (s === best.s && l < best.l)) best = { x: f.x, y: f.y, rot, s, l, w, h };
        }
      }
    }
    if (!best) { ok = false; continue; }
    res[i] = { x: best.x, y: best.y, rot: best.rot };
    const nf: typeof free = [];
    for (const f of free) {
      if (best.x >= f.x + f.w || best.x + best.w <= f.x || best.y >= f.y + f.h || best.y + best.h <= f.y) { nf.push(f); continue; }
      if (best.x > f.x) nf.push({ x: f.x, y: f.y, w: best.x - f.x, h: f.h });
      if (best.x + best.w < f.x + f.w) nf.push({ x: best.x + best.w, y: f.y, w: f.x + f.w - best.x - best.w, h: f.h });
      if (best.y > f.y) nf.push({ x: f.x, y: f.y, w: f.w, h: best.y - f.y });
      if (best.y + best.h < f.y + f.h) nf.push({ x: f.x, y: best.y + best.h, w: f.w, h: f.y + f.h - best.y - best.h });
    }
    free = nf.filter((a, ai) => !nf.some((b, bi) => bi !== ai && a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h && (bi < ai || a.w !== b.w || a.h !== b.h || a.x !== b.x || a.y !== b.y)));
  }
  return { pos: res, ok };
}

function buildOne(pieces: Piece[]): { blob: Blob; fits: boolean } {
  const items: Placed[] = pieces.map((p) => {
    const g = p.g.clone();
    g.computeBoundingBox();
    const b = g.boundingBox!;
    g.translate(-b.min.x, -b.min.y, -b.min.z);
    return { g, w: b.max.x - b.min.x, h: b.max.y - b.min.y, name: p.name };
  });
  const r = pack(items);
  const group = new THREE.Group();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, tooTall = false;
  const meshes = items.map((it, i) => {
    const g = it.g;
    if (r.pos[i].rot) { g.rotateZ(Math.PI / 2); g.computeBoundingBox(); const b = g.boundingBox!; g.translate(-b.min.x, -b.min.y, 0); }
    g.computeBoundingBox();
    if (g.boundingBox!.max.z > PLATE.z) tooTall = true;
    const m = new THREE.Mesh(g);
    m.position.set(r.pos[i].x, r.pos[i].y, 0);
    const w = r.pos[i].rot ? it.h : it.w, h = r.pos[i].rot ? it.w : it.h;
    minX = Math.min(minX, r.pos[i].x); minY = Math.min(minY, r.pos[i].y);
    maxX = Math.max(maxX, r.pos[i].x + w); maxY = Math.max(maxY, r.pos[i].y + h);
    return m;
  });
  // Anordnung mittig auf die Platte setzen
  const ox = PLATE.margin + ((PLATE.x - 2 * PLATE.margin) - (maxX - minX)) / 2 - minX;
  const oy = PLATE.margin + ((PLATE.y - 2 * PLATE.margin) - (maxY - minY)) / 2 - minY;
  meshes.forEach((m) => { m.position.x += ox; m.position.y += oy; group.add(m); });
  group.updateMatrixWorld(true);
  const dv = new STLExporter().parse(group, { binary: true }) as unknown as DataView;
  items.forEach((it) => it.g.dispose());
  return { blob: new Blob([dv.buffer as ArrayBuffer], { type: "model/stl" }), fits: r.ok && !tooTall };
}

export function buildPlates(res: SpardoseResult, colors: { text: string; base: string; cap: string }, labelOf: (hex: string) => string): PlatePlan[] {
  const letters = res.letters.clone();
  letters.rotateX(Math.PI); // flache Rückseite nach unten
  const groups = new Map<string, Piece[]>();
  const add = (hex: string, p: Piece) => { (groups.get(hex) ?? groups.set(hex, []).get(hex)!).push(p); };
  add(colors.base, { g: res.body, name: "Körper" });
  splitComponents(letters).forEach((g, i) => add(colors.text, { g, name: `Buchstabe ${i + 1}` }));
  add(colors.cap, { g: res.cap, name: "Kappe" });
  letters.dispose();
  const plans: PlatePlan[] = [];
  groups.forEach((pieces, hex) => {
    const { blob, fits } = buildOne(pieces);
    plans.push({ hex, label: labelOf(hex), blob, fits, count: pieces.length, info: pieces.map((p) => p.name).join(", ") });
  });
  groups.forEach((pieces) => pieces.forEach((p) => { if (p.name.startsWith("Buchstabe")) p.g.dispose(); }));
  return plans;
}
