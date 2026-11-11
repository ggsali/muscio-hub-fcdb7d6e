// Gravur-Werkzeug: Bild mit Text -> Vektor -> aus einem 3D-Modell schneiden (ohne Offset).
// Modell minus Textkörper = Modell mit Aussparung; Modell geschnitten mit Textkörper = passende Einlage.
import * as THREE from "three";
import ClipperLib from "clipper-lib";
import JSZip from "jszip";
import { Brush, Evaluator, INTERSECTION, SUBTRACTION } from "three-bvh-csg";

export type RasterIn = { data: Uint8ClampedArray | Uint8Array; width: number; height: number };
export type Pt = [number, number];

/* ---------- Bild -> Maske ---------- */

function otsu(lum: Uint8Array): number {
  const hist = new Array(256).fill(0);
  for (const v of lum) hist[v]++;
  const total = lum.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sB = 0, wB = 0, best = -1, first = 128, last = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sB += t * hist[t];
    const mB = sB / wB, mF = (sum - sB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best + 1e-9) { best = between; first = last = t; }
    else if (Math.abs(between - best) <= 1e-9) last = t; // Plateau (z. B. reines Schwarz/Weiss): Mitte nehmen
  }
  return Math.round((first + last) / 2) + 1;
}

/** Gauss-Weichzeichner (getrennt), glättet Pixelstufen vor dem Konturieren */
export function blurField(f: Float32Array, w: number, h: number, sigma: number): Float32Array {
  if (sigma <= 0) return f;
  const r = Math.max(1, Math.ceil(sigma * 2.5));
  const k = new Float32Array(2 * r + 1);
  let sum = 0;
  for (let i = -r; i <= r; i++) { k[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma)); sum += k[i + r]; }
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  const tmp = new Float32Array(f.length), out = new Float32Array(f.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let a = 0;
    for (let i = -r; i <= r; i++) a += k[i + r] * f[y * w + Math.min(w - 1, Math.max(0, x + i))];
    tmp[y * w + x] = a;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let a = 0;
    for (let i = -r; i <= r; i++) a += k[i + r] * tmp[Math.min(h - 1, Math.max(0, y + i)) * w + x];
    out[y * w + x] = a;
  }
  return out;
}

export type MaskResult = { field: Float32Array; width: number; height: number; invertUsed: boolean; threshold: number; alphaMode: boolean };

/** Vordergrund (= Text) als weiche Maske 0..1. Transparente PNGs: Alpha. Sonst Helligkeit mit Otsu, Text = kleinere Fläche. */
export function maskFromImage(img: RasterIn, o: { threshold?: number | null; invert?: boolean | null; blur?: number } = {}): MaskResult {
  const blur = o.blur ?? 1.1;
  const { width: w, height: h, data } = img;
  const n = w * h;
  let transparent = 0;
  for (let i = 0; i < n; i++) if (data[i * 4 + 3] < 250) transparent++;
  const field = new Float32Array(n);
  if (transparent / n > 0.02) {
    const inv = !!o.invert;
    for (let i = 0; i < n; i++) { const a = data[i * 4 + 3] / 255; field[i] = inv ? 1 - a : a; }
    return { field: blurField(field, w, h, blur), width: w, height: h, invertUsed: inv, threshold: 128, alphaMode: true };
  }
  const lum = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const a = data[i * 4 + 3] / 255;
    // auf Weiss legen, falls halbtransparent
    const r = data[i * 4] * a + 255 * (1 - a), g = data[i * 4 + 1] * a + 255 * (1 - a), b = data[i * 4 + 2] * a + 255 * (1 - a);
    lum[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }
  const th = o.threshold ?? otsu(lum);
  let dark = 0;
  for (let i = 0; i < n; i++) if (lum[i] < th) dark++;
  let fgDark = dark <= n / 2; // Text ist die kleinere Fläche
  if (o.invert) fgDark = !fgDark;
  for (let i = 0; i < n; i++) {
    const d = fgDark ? th - lum[i] : lum[i] - th;
    field[i] = Math.min(1, Math.max(0, d / 64 + 0.5)); // weiche Kante: Kontur liegt bei Schwelle, Antialiasing ergibt Subpixel-Genauigkeit
  }
  return { field: blurField(field, w, h, blur), width: w, height: h, invertUsed: !!o.invert, threshold: th, alphaMode: false };
}

/* ---------- Marching Squares ---------- */

export function traceField(f: Float32Array, w: number, h: number, level = 0.5): Pt[][] {
  const W = w + 2, H = h + 2;
  const P = new Float32Array(W * H);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) P[(y + 1) * W + x + 1] = f[y * w + x];
  const pts = new Map<string, Pt>();
  const adj = new Map<string, string[]>();
  const hEdge = (i: number, j: number) => {
    const id = `h${i},${j}`;
    if (!pts.has(id)) { const a = P[j * W + i], b = P[j * W + i + 1]; pts.set(id, [i - 0.5 + (level - a) / (b - a), j - 0.5]); }
    return id;
  };
  const vEdge = (i: number, j: number) => {
    const id = `v${i},${j}`;
    if (!pts.has(id)) { const a = P[j * W + i], b = P[(j + 1) * W + i]; pts.set(id, [i - 0.5, j - 0.5 + (level - a) / (b - a)]); }
    return id;
  };
  const link = (a: string, b: string) => {
    (adj.get(a) ?? adj.set(a, []).get(a)!).push(b);
    (adj.get(b) ?? adj.set(b, []).get(b)!).push(a);
  };
  for (let j = 0; j < H - 1; j++) {
    for (let i = 0; i < W - 1; i++) {
      const a = P[j * W + i], b = P[j * W + i + 1], c = P[(j + 1) * W + i + 1], d = P[(j + 1) * W + i];
      const k = (a >= level ? 8 : 0) | (b >= level ? 4 : 0) | (c >= level ? 2 : 0) | (d >= level ? 1 : 0);
      if (k === 0 || k === 15) continue;
      const T = () => hEdge(i, j), R = () => vEdge(i + 1, j), B = () => hEdge(i, j + 1), L = () => vEdge(i, j);
      switch (k) {
        case 1: case 14: link(L(), B()); break;
        case 2: case 13: link(B(), R()); break;
        case 3: case 12: link(L(), R()); break;
        case 4: case 11: link(T(), R()); break;
        case 6: case 9: link(T(), B()); break;
        case 7: case 8: link(L(), T()); break;
        case 5: { const centre = (a + b + c + d) / 4 >= level; if (centre) { link(L(), T()); link(B(), R()); } else { link(T(), R()); link(L(), B()); } break; }
        case 10: { const centre = (a + b + c + d) / 4 >= level; if (centre) { link(T(), R()); link(L(), B()); } else { link(L(), T()); link(B(), R()); } break; }
      }
    }
  }
  const seen = new Set<string>();
  const loops: Pt[][] = [];
  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    const loop: Pt[] = [];
    let prev = "", cur = start;
    for (;;) {
      seen.add(cur);
      loop.push(pts.get(cur)!);
      const nb = adj.get(cur)!;
      const next = nb.find((q) => q !== prev && !seen.has(q)) ?? nb.find((q) => q !== prev);
      if (!next || next === start || seen.has(next)) break;
      prev = cur;
      cur = next;
    }
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}

function areaOf(l: Pt[]) {
  let a = 0;
  for (let i = 0; i < l.length; i++) { const p = l[i], q = l[(i + 1) % l.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return a / 2;
}

/** Douglas-Peucker für geschlossene Konturen */
export function simplifyLoop(loop: Pt[], eps: number): Pt[] {
  if (loop.length < 4 || eps <= 0) return loop;
  const pts = [...loop, loop[0]];
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    const [ax, ay] = pts[s], [bx, by] = pts[e];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1e-9;
    let mx = -1, mi = -1;
    for (let i = s + 1; i < e; i++) {
      const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / len;
      if (d > mx) { mx = d; mi = i; }
    }
    if (mx > eps && mi > 0) { keep[mi] = 1; stack.push([s, mi], [mi, e]); }
  }
  const out: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) if (keep[i]) out.push(pts[i]);
  return out.length >= 3 ? out : loop;
}

export type Prepared = {
  /** Formen in Pixeln, Y nach oben (Bild gespiegelt), Ursprung = linke untere Bildecke */
  shapes: THREE.Shape[];
  width: number;
  height: number;
  ink: { x0: number; y0: number; x1: number; y1: number } | null;
  invertUsed: boolean;
  threshold: number;
  loops: number;
};

const K = 1000;

export function prepareImage(img: RasterIn, o: { threshold?: number | null; invert?: boolean | null; simplify?: number; minArea?: number; blur?: number } = {}): Prepared {
  const m = maskFromImage(img, o);
  const raw = traceField(m.field, m.width, m.height).filter((l) => Math.abs(areaOf(l)) >= (o.minArea ?? 3));
  const loops = raw.map((l) => simplifyLoop(l, o.simplify ?? 0.2));
  const c = new ClipperLib.Clipper();
  for (const l of loops) c.AddPath(l.map(([x, y]) => ({ X: Math.round(x * K), Y: Math.round((m.height - y) * K) })), ClipperLib.PolyType.ptSubject, true);
  const tree = new ClipperLib.PolyTree();
  c.Execute(ClipperLib.ClipType.ctUnion, tree, ClipperLib.PolyFillType.pftEvenOdd, ClipperLib.PolyFillType.pftEvenOdd);
  const shapes: THREE.Shape[] = [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const toV = (path: { X: number; Y: number }[], outer: boolean) =>
    path.map((q) => {
      const x = q.X / K, y = q.Y / K;
      if (outer) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      return new THREE.Vector2(x, y);
    });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const walk = (node: any) => {
    for (const ch of node.Childs()) {
      if (ch.IsHole()) { walk(ch); continue; }
      const sh = new THREE.Shape(toV(ch.Contour(), true));
      for (const hole of ch.Childs()) { sh.holes.push(new THREE.Path(toV(hole.Contour(), false))); walk(hole); }
      shapes.push(sh);
    }
  };
  walk(tree);
  return {
    shapes, width: m.width, height: m.height, loops: loops.length,
    ink: shapes.length ? { x0, y0, x1, y1 } : null,
    invertUsed: m.invertUsed, threshold: m.threshold,
  };
}

/* ---------- Ausrichtfläche ---------- */

export type FaceInfo = {
  tris: number[];
  normal: THREE.Vector3;
  /** lokal -> Welt: z = Flächennormale (nach aussen), Ursprung = Mitte der Fläche */
  frame: THREE.Matrix4;
  size: { w: number; h: number };
};

/** Zusammenhängende, ebene Fläche um ein angeklicktes Dreieck (Geometrie ohne Index) */
export function faceRegion(geo: THREE.BufferGeometry, tri: number, angleTol = 0.9995, distTol = 0.03): FaceInfo | null {
  const pos = geo.getAttribute("position");
  const n = pos.count / 3;
  if (tri < 0 || tri >= n) return null;
  const key = (i: number) => `${Math.round(pos.getX(i) * 1000)},${Math.round(pos.getY(i) * 1000)},${Math.round(pos.getZ(i) * 1000)}`;
  const nrm = new Float32Array(n * 3);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), t = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    a.fromBufferAttribute(pos, i * 3); b.fromBufferAttribute(pos, i * 3 + 1); c.fromBufferAttribute(pos, i * 3 + 2);
    t.subVectors(b, a).cross(c.clone().sub(a));
    const l = t.length();
    if (l > 0) t.divideScalar(l);
    nrm[i * 3] = t.x; nrm[i * 3 + 1] = t.y; nrm[i * 3 + 2] = t.z;
  }
  const edges = new Map<string, number[]>();
  for (let i = 0; i < n; i++) {
    const k = [key(i * 3), key(i * 3 + 1), key(i * 3 + 2)];
    for (let e = 0; e < 3; e++) {
      const p = k[e], q = k[(e + 1) % 3];
      const ek = p < q ? `${p}|${q}` : `${q}|${p}`;
      (edges.get(ek) ?? edges.set(ek, []).get(ek)!).push(i);
    }
  }
  const n0 = new THREE.Vector3(nrm[tri * 3], nrm[tri * 3 + 1], nrm[tri * 3 + 2]);
  if (n0.lengthSq() === 0) return null;
  const p0 = new THREE.Vector3().fromBufferAttribute(pos, tri * 3);
  const inRegion = new Set<number>([tri]);
  const queue = [tri];
  const v = new THREE.Vector3();
  while (queue.length) {
    const cur = queue.pop()!;
    const k = [key(cur * 3), key(cur * 3 + 1), key(cur * 3 + 2)];
    for (let e = 0; e < 3; e++) {
      const p = k[e], q = k[(e + 1) % 3];
      for (const nb of edges.get(p < q ? `${p}|${q}` : `${q}|${p}`) ?? []) {
        if (inRegion.has(nb)) continue;
        const dot = nrm[nb * 3] * n0.x + nrm[nb * 3 + 1] * n0.y + nrm[nb * 3 + 2] * n0.z;
        if (dot < angleTol) continue;
        v.fromBufferAttribute(pos, nb * 3).sub(p0);
        if (Math.abs(v.dot(n0)) > distTol) continue;
        inRegion.add(nb);
        queue.push(nb);
      }
    }
  }
  const tris = [...inRegion];
  // Koordinatensystem: z = Normale, y = Weltoben (Z) bzw. Y, wenn die Fläche waagrecht liegt
  const upHint = Math.abs(n0.z) < 0.99 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
  const yAxis = upHint.clone().sub(n0.clone().multiplyScalar(upHint.dot(n0))).normalize();
  const xAxis = new THREE.Vector3().crossVectors(yAxis, n0).normalize();
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const i of tris) for (let k = 0; k < 3; k++) {
    v.fromBufferAttribute(pos, i * 3 + k);
    const x = v.dot(xAxis), y = v.dot(yAxis);
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = p0.dot(n0);
  const origin = xAxis.clone().multiplyScalar(cx).add(yAxis.clone().multiplyScalar(cy)).add(n0.clone().multiplyScalar(cz));
  const frame = new THREE.Matrix4().makeBasis(xAxis, yAxis, n0).setPosition(origin);
  return { tris, normal: n0, frame, size: { w: maxX - minX, h: maxY - minY } };
}

/* ---------- Gravur ---------- */

export type Place = {
  /** Breite des Bildrahmens in mm (1:1 = Originalverhältnis) */
  widthMm: number;
  dx: number;
  dy: number;
  rotDeg: number;
  /** Gravurtiefe in mm */
  depth: number;
  /** false: Bildmitte ist der Ankerpunkt (1:1), true: Mitte des Textes */
  centerInk: boolean;
};

export const DEFAULT_PLACE: Place = { widthMm: 60, dx: 0, dy: 0, rotDeg: 0, depth: 0.6, centerInk: false };

function anchor(prep: Prepared, centerInk: boolean) {
  if (centerInk && prep.ink) return { cx: (prep.ink.x0 + prep.ink.x1) / 2, cy: (prep.ink.y0 + prep.ink.y1) / 2 };
  return { cx: prep.width / 2, cy: prep.height / 2 };
}

/** Matrix: Bildpixel (Y nach oben) -> Welt */
export function placeMatrix(prep: Prepared, pl: Place, frame: THREE.Matrix4): THREE.Matrix4 {
  const s = pl.widthMm / prep.width;
  const { cx, cy } = anchor(prep, pl.centerInk);
  return new THREE.Matrix4()
    .copy(frame)
    .multiply(new THREE.Matrix4().makeTranslation(pl.dx, pl.dy, 0))
    .multiply(new THREE.Matrix4().makeRotationZ((pl.rotDeg * Math.PI) / 180))
    .multiply(new THREE.Matrix4().makeScale(s, s, s))
    .multiply(new THREE.Matrix4().makeTranslation(-cx, -cy, 0));
}

/** Flache Vorschau des Textes (leicht über der Fläche) */
export function overlayGeometry(prep: Prepared, pl: Place, frame: THREE.Matrix4, lift = 0.05): THREE.BufferGeometry | null {
  if (!prep.shapes.length) return null;
  const g = new THREE.ShapeGeometry(prep.shapes, 1);
  g.translate(0, 0, lift / (pl.widthMm / prep.width));
  g.applyMatrix4(placeMatrix(prep, pl, frame));
  g.deleteAttribute("uv");
  return g;
}

/** Textkörper: von 1.5 mm über der Fläche bis zur Gravurtiefe darunter */
export function prismGeometry(prep: Prepared, pl: Place, frame: THREE.Matrix4, margin = 1.5): THREE.BufferGeometry | null {
  if (!prep.shapes.length) return null;
  const s = pl.widthMm / prep.width;
  const g = new THREE.ExtrudeGeometry(prep.shapes, { depth: (pl.depth + margin) / s, bevelEnabled: false, curveSegments: 1, steps: 1 });
  g.translate(0, 0, -pl.depth / s);
  g.applyMatrix4(placeMatrix(prep, pl, frame));
  g.deleteAttribute("uv");
  return g;
}

function cleanForCsg(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g.clone();
  for (const k of Object.keys(out.attributes)) if (k !== "position" && k !== "normal") out.deleteAttribute(k);
  out.computeVertexNormals();
  return out;
}

/** Druckausrichtung: gewählte Fläche liegt auf der Bauplatte (Fläche bei z = 0, Material darüber, Mitte der Fläche bei x/y = 0).
 *  Beide Teile bekommen dieselbe Matrix, die Baugruppe bleibt also zusammen. */
export function bedMatrix(frame: THREE.Matrix4): THREE.Matrix4 {
  return new THREE.Matrix4().makeRotationX(Math.PI).multiply(frame.clone().invert());
}

export type EngraveResult = { modell: THREE.BufferGeometry; einlage: THREE.BufferGeometry; logo?: THREE.BufferGeometry; volModell: number; volEinlage: number; rueckfall?: boolean };

export function engrave(model: THREE.BufferGeometry, prep: Prepared, pl: Place, frame: THREE.Matrix4): EngraveResult | null {
  const prism = prismGeometry(prep, pl, frame);
  if (!prism) return null;
  const a = new Brush(cleanForCsg(model));
  const b = new Brush(cleanForCsg(prism));
  a.updateMatrixWorld();
  b.updateMatrixWorld();
  const ev = new Evaluator();
  ev.attributes = ["position", "normal"];
  ev.useGroups = false;
  const cut = ev.evaluate(a, b, SUBTRACTION);
  const ins = ev.evaluate(a, b, INTERSECTION);
  let einlage = ins.geometry;
  let volEinlage = volume(einlage);
  // Erwartetes Volumen = Textfläche × Tiefe. Liefert der Schnitt (z. B. bei nicht geschlossenem Modell) viel zu wenig,
  // wird die Einlage als voller Textkörper von der Fläche bis zur Gravurtiefe gebaut.
  const s = pl.widthMm / prep.width;
  let flaeche = 0;
  for (const sh of prep.shapes) {
    flaeche += Math.abs(THREE.ShapeUtils.area(sh.getPoints()));
    for (const h of sh.holes) flaeche -= Math.abs(THREE.ShapeUtils.area(h.getPoints()));
  }
  const soll = flaeche * s * s * pl.depth;
  let rueckfall = false;
  if (volEinlage < soll * 0.5) {
    const full = prismGeometry(prep, pl, frame, 0);
    if (full) { einlage = cleanForCsg(full); volEinlage = volume(einlage); rueckfall = true; full.dispose(); }
  }
  prism.dispose();
  return { modell: cut.geometry, einlage, volModell: volume(cut.geometry), volEinlage, rueckfall };
}

export function volume(g: THREE.BufferGeometry): number {
  const t = triangles(g);
  let v = 0;
  for (let i = 0; i < t.length; i += 9) {
    v += (t[i] * (t[i + 4] * t[i + 8] - t[i + 5] * t[i + 7]) - t[i + 1] * (t[i + 3] * t[i + 8] - t[i + 5] * t[i + 6]) + t[i + 2] * (t[i + 3] * t[i + 7] - t[i + 4] * t[i + 6])) / 6;
  }
  return Math.abs(v);
}

/** 9 Zahlen pro Dreieck */
export function triangles(g: THREE.BufferGeometry): Float32Array {
  const p = g.getAttribute("position");
  const ix = g.index;
  const n = ix ? ix.count : p.count;
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const k = ix ? ix.getX(i) : i;
    out[i * 3] = p.getX(k); out[i * 3 + 1] = p.getY(k); out[i * 3 + 2] = p.getZ(k);
  }
  return out;
}

/* ---------- Export ---------- */

export function toStl(g: THREE.BufferGeometry, name = "3DMuscio Gravur"): ArrayBuffer {
  const t = triangles(g);
  const n = t.length / 9;
  const buf = new ArrayBuffer(84 + n * 50);
  const dv = new DataView(buf);
  for (let i = 0; i < Math.min(name.length, 79); i++) dv.setUint8(i, name.charCodeAt(i) & 0x7f);
  dv.setUint32(80, n, true);
  let o = 84;
  for (let i = 0; i < n; i++) {
    const q = i * 9;
    const ux = t[q + 3] - t[q], uy = t[q + 4] - t[q + 1], uz = t[q + 5] - t[q + 2];
    const vx = t[q + 6] - t[q], vy = t[q + 7] - t[q + 1], vz = t[q + 8] - t[q + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    dv.setFloat32(o, nx, true); dv.setFloat32(o + 4, ny, true); dv.setFloat32(o + 8, nz, true);
    o += 12;
    for (let k = 0; k < 9; k++) { dv.setFloat32(o, t[q + k], true); o += 4; }
    o += 2;
  }
  return buf;
}

function meshXml(id: number, name: string, g: THREE.BufferGeometry, pindex: number) {
  const t = triangles(g);
  const map = new Map<string, number>();
  const verts: string[] = [];
  const idx: string[] = [];
  const vi = (x: number, y: number, z: number) => {
    const k = `${Math.round(x * 10000)},${Math.round(y * 10000)},${Math.round(z * 10000)}`;
    let i = map.get(k);
    if (i === undefined) { i = verts.length; map.set(k, i); verts.push(`<vertex x="${+x.toFixed(4)}" y="${+y.toFixed(4)}" z="${+z.toFixed(4)}"/>`); }
    return i;
  };
  for (let i = 0; i < t.length; i += 9) {
    const a = vi(t[i], t[i + 1], t[i + 2]), b = vi(t[i + 3], t[i + 4], t[i + 5]), c = vi(t[i + 6], t[i + 7], t[i + 8]);
    if (a !== b && b !== c && a !== c) idx.push(`<triangle v1="${a}" v2="${b}" v3="${c}"/>`);
  }
  return `<object id="${id}" type="model" name="${name}" pid="100" pindex="${pindex}"><mesh><vertices>${verts.join("")}</vertices><triangles>${idx.join("")}</triangles></mesh></object>`;
}

/** 3MF mit einer Baugruppe aus Einzelteilen, alle an Ort und Stelle */
export async function to3mf(parts: { name: string; geo: THREE.BufferGeometry; color?: string }[], assemblyName: string): Promise<Blob> {
  const objs = parts.map((p, i) => meshXml(i + 1, p.name, p.geo, i)).join("");
  const hex = (c?: string, d = "#9AA3AD") => (/^#[0-9a-f]{6}$/i.test(c ?? "") ? c! : d).toUpperCase() + "FF";
  const mats = `<basematerials id="100">${parts.map((p) => `<base name="${p.name}" displaycolor="${hex(p.color)}"/>`).join("")}</basematerials>`;
  const asmId = parts.length + 1;
  const comps = parts.map((_, i) => `<component objectid="${i + 1}"/>`).join("");
  const model = `<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="de-CH" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><metadata name="Title">${assemblyName}</metadata><metadata name="Application">3DMuscio Gravur</metadata><resources>${mats}${objs}<object id="${asmId}" type="model" name="${assemblyName}"><components>${comps}</components></object></resources><build><item objectid="${asmId}"/></build></model>`;
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`);
  zip.file("3D/3dmodel.model", model);
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.ms-package.3dmanufacturing-3dmodel+xml", compression: "DEFLATE" });
}

export function safeName(s: string) {
  return s.replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "gravur";
}
