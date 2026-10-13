import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export const GRID = 64;

export function wgs84ToLv95(lat: number, lon: number) {
  const p = (lat * 3600 - 169028.66) / 10000;
  const l = (lon * 3600 - 26782.5) / 10000;
  const e = 2600072.37 + 211455.93 * l - 10938.51 * l * p - 0.36 * l * p * p - 44.54 * l ** 3;
  const n = 1200147.07 + 308807.95 * p + 3745.25 * l * l + 76.63 * p * p - 194.56 * l * l * p + 119.79 * p ** 3;
  return { e, n };
}

function resample(vals: number[], count: number) {
  if (vals.length === count) return vals;
  return Array.from({ length: count }, (_, i) => {
    const t = (i / (count - 1)) * (vals.length - 1);
    const a = Math.floor(t), b = Math.min(vals.length - 1, a + 1);
    return vals[a] + (vals[b] - vals[a]) * (t - a);
  });
}

/** Heights [row j (south→north)][col i (west→east)] in metres from swisstopo. */
export async function ladeHoehen(lat: number, lon: number, kanteM: number, onProgress?: (p: number) => void) {
  const { e, n } = wgs84ToLv95(lat, lon);
  const h = kanteM / 2;
  const rows: number[][] = [];
  let done = 0;
  const jobs = Array.from({ length: GRID }, (_, j) => async () => {
    const y = n - h + (j / (GRID - 1)) * kanteM;
    const geom = JSON.stringify({ type: "LineString", coordinates: [[e - h, y], [e + h, y]] });
    const url = `https://api3.geo.admin.ch/rest/services/profile.json?sr=2056&nb_points=${GRID}&geom=${encodeURIComponent(geom)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Höhendaten konnten nicht geladen werden");
    const data: { alts: Record<string, number> }[] = await res.json();
    rows[j] = resample(data.map((d) => d.alts.DTM2 ?? d.alts.COMB ?? d.alts.DTM25 ?? 0), GRID);
    onProgress?.(++done / GRID);
  });
  for (let k = 0; k < jobs.length; k += 8) await Promise.all(jobs.slice(k, k + 8).map((f) => f()));
  return rows;
}

const OVERPASS_SERVER = [
  "https://overpass.osm.ch/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter",
];

export type DachForm = "flach" | "sattel" | "walm" | "pult";
export interface Gebaeude { ring: [number, number][]; hoeheM: number; dachM: number; dach: DachForm }

const TYP_HOEHE: Record<string, number> = {
  garage: 3, garages: 3, carport: 2.6, shed: 2.8, hut: 3, kiosk: 3, roof: 4, greenhouse: 3.5,
  house: 6.5, detached: 6.5, semidetached_house: 6.5, terrace: 7, bungalow: 4, cabin: 4,
  farm: 7, barn: 7, farm_auxiliary: 5, stable: 5, residential: 9, apartments: 13,
  commercial: 11, retail: 7, office: 14, industrial: 9, warehouse: 9, school: 11,
  hospital: 18, hotel: 15, public: 11, civic: 11, church: 14, chapel: 8, cathedral: 25,
  train_station: 10, transportation: 8, service: 3.5, yes: 7,
};
const PITCHED_TYPEN = new Set(["house", "detached", "semidetached_house", "terrace", "farm", "barn", "farm_auxiliary", "stable", "church", "chapel", "cabin", "hut", "bungalow", "shed", "residential", "yes"]);

function parseM(v?: string) { const n = parseFloat(String(v ?? "").replace(",", ".")); return isFinite(n) ? n : NaN; }

function ringArea(r: [number, number][]) { let a = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }

function interpretiere(t: Record<string, string>, ring: [number, number][]): Gebaeude {
  const typ = t.building || "yes";
  const levels = parseM(t["building:levels"]);
  const roofLevels = parseM(t["roof:levels"]);
  const area = Math.abs(ringArea(ring));
  let shape = (t["roof:shape"] || "").toLowerCase();
  if (!shape) shape = PITCHED_TYPEN.has(typ) && area < 700 && !(levels > 4) ? "gabled" : "flat";
  const dach: DachForm = shape === "gabled" || shape === "gambrel" || shape === "saltbox" ? "sattel"
    : shape === "hipped" || shape === "half-hipped" || shape === "pyramidal" || shape === "mansard" ? "walm"
    : shape === "skillion" ? "pult" : "flach";
  let total = parseM(t.height);
  let roofM = parseM(t["roof:height"]);
  if (!isFinite(total)) {
    const wall = isFinite(levels) ? levels * 2.9 + 0.5 : TYP_HOEHE[typ] ?? 7;
    if (!isFinite(roofM)) roofM = dach === "flach" ? 0 : isFinite(roofLevels) ? roofLevels * 2.5 : Math.min(Math.sqrt(area) * 0.35, 7);
    total = wall + roofM;
  } else if (!isFinite(roofM)) roofM = dach === "flach" ? 0 : Math.min(total * 0.35, Math.sqrt(area) * 0.35);
  total = Math.min(Math.max(total, 2.5), 200);
  roofM = dach === "flach" ? 0 : Math.min(Math.max(roofM, 0.8), total * 0.7);
  return { ring, hoeheM: total, dachM: roofM, dach };
}

/** Building footprints in local metres (x east, y north) relative to centre. */
export async function ladeGebaeude(lat: number, lon: number, kanteM: number): Promise<Gebaeude[]> {
  const dLat = kanteM / 2 / 110540;
  const dLon = kanteM / 2 / (111320 * Math.cos((lat * Math.PI) / 180));
  const bb = `${lat - dLat},${lon - dLon},${lat + dLat},${lon + dLon}`;
  const q = `[out:json][timeout:25];(way["building"](${bb});way["building:part"](${bb});relation["building"]["type"="multipolygon"](${bb}););out tags geom;`;
  let data: any = null;
  for (const server of OVERPASS_SERVER) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 20000);
      const res = await fetch(server, { method: "POST", body: "data=" + encodeURIComponent(q), signal: ctrl.signal });
      clearTimeout(t);
      if (res.ok) { data = await res.json(); break; }
    } catch { /* nächster Server */ }
  }
  if (!data) throw new Error("Gebäudedaten konnten nicht geladen werden");
  const kx = 111320 * Math.cos((lat * Math.PI) / 180);
  const toRing = (geom: any[]): [number, number][] => {
    const r = geom.map((g: any) => [(g.lon - lon) * kx, (g.lat - lat) * 110540] as [number, number]);
    if (r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1]) r.pop();
    return r;
  };
  const out: Gebaeude[] = [];
  for (const el of data.elements || []) {
    const t = el.tags || {};
    if (el.type === "way" && el.geometry?.length > 3) out.push(interpretiere({ ...t, building: t.building || t["building:part"] }, toRing(el.geometry)));
    if (el.type === "relation") for (const m of el.members || []) if (m.role === "outer" && m.geometry?.length > 3) out.push(interpretiere(t, toRing(m.geometry)));
  }
  return out;
}

/** Minimum-area oriented rectangle: returns centre, unit axis u (long), half extents. */
function obb(ring: [number, number][]) {
  let best: { a: number; ux: number; uy: number; cx: number; cy: number; hl: number; hw: number } | null = null;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length];
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]); if (len < 1e-6) continue;
    const ux = (q[0] - p[0]) / len, uy = (q[1] - p[1]) / len;
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const [x, y] of ring) { const a = x * ux + y * uy, b = -x * uy + y * ux; a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b); }
    const area = (a1 - a0) * (b1 - b0);
    if (!best || area < best.a) {
      const ca = (a0 + a1) / 2, cb = (b0 + b1) / 2;
      let hl = (a1 - a0) / 2, hw = (b1 - b0) / 2, vx = ux, vy = uy;
      if (hw > hl) { [hl, hw] = [hw, hl]; vx = -uy; vy = ux; }
      best = { a: area, ux: vx, uy: vy, cx: ca * ux - cb * uy, cy: ca * uy + cb * ux, hl, hw };
    }
  }
  return best;
}

function clip(ring: [number, number][], h: number): [number, number][] {
  let out = ring;
  const edges: [(p: [number, number]) => boolean, (a: [number, number], b: [number, number]) => [number, number]][] = [
    [(p) => p[0] >= -h, (a, b) => [-h, a[1] + ((b[1] - a[1]) * (-h - a[0])) / (b[0] - a[0])]],
    [(p) => p[0] <= h, (a, b) => [h, a[1] + ((b[1] - a[1]) * (h - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] >= -h, (a, b) => [a[0] + ((b[0] - a[0]) * (-h - a[1])) / (b[1] - a[1]), -h]],
    [(p) => p[1] <= h, (a, b) => [a[0] + ((b[0] - a[0]) * (h - a[1])) / (b[1] - a[1]), h]],
  ];
  for (const [inside, cut] of edges) {
    const inp = out; out = [];
    for (let i = 0; i < inp.length; i++) {
      const cur = inp[i], prev = inp[(i + inp.length - 1) % inp.length];
      if (inside(cur)) { if (!inside(prev)) out.push(cut(prev, cur)); out.push(cur); }
      else if (inside(prev)) out.push(cut(prev, cur));
    }
    if (!out.length) break;
  }
  return out;
}

/** Builds a z-up mesh in millimetres. */
export function baueModell(hoehen: number[][], gebaeude: Gebaeude[], kanteM: number, massstab: number, sockelMm: number) {
  const s = 1000 / massstab;
  const size = kanteM * s;
  let hmin = Infinity;
  hoehen.forEach((r) => r.forEach((v) => (hmin = Math.min(hmin, v))));
  const zAt = (i: number, j: number) => sockelMm + (hoehen[j][i] - hmin) * s;
  const xAt = (i: number) => -size / 2 + (i / (GRID - 1)) * size;
  const pos: number[] = [];
  const tri = (a: number[], b: number[], c: number[]) => pos.push(...a, ...b, ...c);
  for (let j = 0; j < GRID - 1; j++)
    for (let i = 0; i < GRID - 1; i++) {
      const a = [xAt(i), xAt(j), zAt(i, j)], b = [xAt(i + 1), xAt(j), zAt(i + 1, j)];
      const c = [xAt(i + 1), xAt(j + 1), zAt(i + 1, j + 1)], d = [xAt(i), xAt(j + 1), zAt(i, j + 1)];
      tri(a, b, c); tri(a, c, d);
      // bottom
      tri([a[0], a[1], 0], [c[0], c[1], 0], [b[0], b[1], 0]);
      tri([a[0], a[1], 0], [d[0], d[1], 0], [c[0], c[1], 0]);
    }
  const L = GRID - 1;
  for (let k = 0; k < L; k++) {
    const x0 = xAt(k), x1 = xAt(k + 1), lo = -size / 2, hi = size / 2;
    // south (y=lo), outward -y
    tri([x0, lo, 0], [x1, lo, 0], [x1, lo, zAt(k + 1, 0)]); tri([x0, lo, 0], [x1, lo, zAt(k + 1, 0)], [x0, lo, zAt(k, 0)]);
    // north (y=hi), outward +y
    tri([x1, hi, 0], [x0, hi, 0], [x0, hi, zAt(k, L)]); tri([x1, hi, 0], [x0, hi, zAt(k, L)], [x1, hi, zAt(k + 1, L)]);
    // west (x=lo), outward -x
    tri([lo, x1, 0], [lo, x0, 0], [lo, x0, zAt(0, k)]); tri([lo, x1, 0], [lo, x0, zAt(0, k)], [lo, x1, zAt(0, k + 1)]);
    // east (x=hi), outward +x
    tri([hi, x0, 0], [hi, x1, 0], [hi, x1, zAt(L, k + 1)]); tri([hi, x0, 0], [hi, x1, zAt(L, k + 1)], [hi, x0, zAt(L, k)]);
  }
  const terrain = new THREE.BufferGeometry();
  terrain.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  terrain.computeVertexNormals();

  const sample = (xm: number, ym: number) => {
    const fi = Math.max(0, Math.min(L, ((xm + kanteM / 2) / kanteM) * L)), fj = Math.max(0, Math.min(L, ((ym + kanteM / 2) / kanteM) * L));
    const i0 = Math.min(L - 1, Math.floor(fi)), j0 = Math.min(L - 1, Math.floor(fj)), ti = fi - i0, tj = fj - j0;
    return (zAt(i0, j0) * (1 - ti) + zAt(i0 + 1, j0) * ti) * (1 - tj) + (zAt(i0, j0 + 1) * (1 - ti) + zAt(i0 + 1, j0 + 1) * ti) * tj;
  };
  const parts: THREE.BufferGeometry[] = [terrain];
  const half = kanteM / 2;
  for (const g of gebaeude) {
    const inside = g.ring.every(([x, y]) => Math.abs(x) <= half && Math.abs(y) <= half);
    const ring = inside ? g.ring : clip(g.ring, half);
    if (ring.length < 3) continue;
    const areaM = Math.abs(ringArea(ring));
    if (areaM * s * s < 0.5) continue;
    // ground: sample footprint + centre, sink below lowest point so slopes stay closed
    const zs = ring.map(([x, y]) => sample(x, y));
    const zMin = Math.min(...zs), zMax = Math.max(...zs);
    const sink = 0.6 + (zMax - zMin);
    const base = zMin - 0.6;
    const top = zMax + Math.max(g.hoeheM * s, 0.8);
    const roof = g.dachM * s;
    const box = inside && g.dach !== "flach" ? obb(ring) : null;
    if (box && areaM / (4 * box.hl * box.hw) > 0.82 && roof > 0.25) {
      parts.push(dachKoerper(box, s, base, top - roof, top, g.dach));
      continue;
    }
    const shape = new THREE.Shape(ring.map(([x, y]) => new THREE.Vector2(x * s, y * s)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: top - base, bevelEnabled: false });
    geo.translate(0, 0, base);
    geo.deleteAttribute("uv");
    parts.push(geo.toNonIndexed());
    void sink;
  }
  const merged = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)), false)!;
  merged.computeBoundingBox();
  return merged;
}

/** Closed solid: rectangular walls up to eave, then gabled / hipped / skillion roof. */
function dachKoerper(b: NonNullable<ReturnType<typeof obb>>, s: number, z0: number, ze: number, zr: number, dach: DachForm) {
  const ux = b.ux, uy = b.uy, vx = -uy, vy = ux;
  const P = (a: number, c: number, z: number) => [(b.cx + a * ux + c * vx) * s, (b.cy + a * uy + c * vy) * s, z];
  const l = b.hl, w = b.hw;
  const c0 = (z: number) => P(-l, -w, z), c1 = (z: number) => P(l, -w, z), c2 = (z: number) => P(l, w, z), c3 = (z: number) => P(-l, w, z);
  const pos: number[] = [];
  const tri = (a: number[], bb: number[], c: number[]) => pos.push(...a, ...bb, ...c);
  const quad = (a: number[], bb: number[], c: number[], d: number[]) => { tri(a, bb, c); tri(a, c, d); };
  // bottom (facing down)
  quad(c0(z0), c3(z0), c2(z0), c1(z0));
  if (dach === "pult") {
    quad(c0(z0), c1(z0), c1(ze), c0(ze));
    quad(c1(z0), c2(z0), c2(zr), c1(ze));
    quad(c2(z0), c3(z0), c3(zr), c2(zr));
    quad(c3(z0), c0(z0), c0(ze), c3(zr));
    quad(c0(ze), c1(ze), c2(zr), c3(zr));
  } else {
    const inset = dach === "walm" ? Math.min(w, l * 0.9) : 0;
    const r0 = P(-l + inset, 0, zr), r1 = P(l - inset, 0, zr);
    quad(c0(z0), c1(z0), c1(ze), c0(ze));
    quad(c1(z0), c2(z0), c2(ze), c1(ze));
    quad(c2(z0), c3(z0), c3(ze), c2(ze));
    quad(c3(z0), c0(z0), c0(ze), c3(ze));
    quad(c0(ze), c1(ze), r1, r0); // south slope
    quad(c2(ze), c3(ze), r0, r1); // north slope
    tri(c1(ze), c2(ze), r1); // east gable / hip
    tri(c3(ze), c0(ze), r0); // west gable / hip
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

export async function exportStl(geo: THREE.BufferGeometry): Promise<Blob> {
  const { STLExporter } = await import("three/examples/jsm/exporters/STLExporter.js");
  const data = new STLExporter().parse(new THREE.Mesh(geo), { binary: true }) as unknown as DataView;
  return new Blob([data.buffer as ArrayBuffer], { type: "model/stl" });
}
