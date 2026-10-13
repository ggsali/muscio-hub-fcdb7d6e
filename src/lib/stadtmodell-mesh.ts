import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export const GRID = 48;

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

export interface Gebaeude { ring: [number, number][]; hoeheM: number }

/** Building footprints in local metres (x east, y north) relative to centre. */
export async function ladeGebaeude(lat: number, lon: number, kanteM: number): Promise<Gebaeude[]> {
  const dLat = kanteM / 2 / 110540;
  const dLon = kanteM / 2 / (111320 * Math.cos((lat * Math.PI) / 180));
  const q = `[out:json][timeout:25];way["building"](${lat - dLat},${lon - dLon},${lat + dLat},${lon + dLon});out tags geom;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: "data=" + encodeURIComponent(q) });
  if (!res.ok) throw new Error("Gebäudedaten konnten nicht geladen werden");
  const data = await res.json();
  const kx = 111320 * Math.cos((lat * Math.PI) / 180);
  return (data.elements || [])
    .filter((el: any) => el.geometry?.length > 3)
    .map((el: any) => {
      const t = el.tags || {};
      let hoeheM = parseFloat(t.height);
      if (!isFinite(hoeheM)) hoeheM = t["building:levels"] ? parseFloat(t["building:levels"]) * 3 + 1 : 8;
      return { ring: el.geometry.map((g: any) => [(g.lon - lon) * kx, (g.lat - lat) * 110540]), hoeheM: Math.min(Math.max(hoeheM, 3), 200) };
    });
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
    const fi = ((xm + kanteM / 2) / kanteM) * L, fj = ((ym + kanteM / 2) / kanteM) * L;
    const i = Math.max(0, Math.min(L, Math.round(fi))), j = Math.max(0, Math.min(L, Math.round(fj)));
    return zAt(i, j);
  };
  const parts: THREE.BufferGeometry[] = [terrain];
  for (const g of gebaeude) {
    const ring = clip(g.ring, kanteM / 2);
    if (ring.length < 3) continue;
    const shape = new THREE.Shape(ring.map(([x, y]) => new THREE.Vector2(x * s, y * s)));
    if (Math.abs(THREE.ShapeUtils.area(shape.getPoints())) < 0.5) continue;
    const ground = Math.min(...ring.map(([x, y]) => sample(x, y)));
    const sink = 0.6;
    const geo = new THREE.ExtrudeGeometry(shape, { depth: Math.max(g.hoeheM * s, 0.8) + sink, bevelEnabled: false });
    geo.translate(0, 0, ground - sink);
    geo.deleteAttribute("uv");
    parts.push(geo.toNonIndexed());
  }
  const merged = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)), false)!;
  merged.computeBoundingBox();
  return merged;
}

export async function exportStl(geo: THREE.BufferGeometry): Promise<Blob> {
  const { STLExporter } = await import("three/examples/jsm/exporters/STLExporter.js");
  const data = new STLExporter().parse(new THREE.Mesh(geo), { binary: true }) as unknown as DataView;
  return new Blob([data.buffer as ArrayBuffer], { type: "model/stl" });
}
