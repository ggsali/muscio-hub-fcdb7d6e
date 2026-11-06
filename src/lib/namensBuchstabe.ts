// Namensbuchstabe (Geburtsbuchstabe): grosser Buchstabe mit Mulde für den Namen und für Zusatz-Icons (Uhr, Ballon, Body, Gewicht).
// Alles wird in 2D mit Polygon-Operationen (Clipper) aufgebaut und danach extrudiert. Teile für den Druck:
//  - Buchstabe (liegt mit der Rückseite auf dem Bett, Vorderseite oben, Mulden vorne)
//  - Name (verbundene Schreibschrift, passt mit etwas Spiel in die Mulde)
//  - je Icon: Platte (passt in die Mulde) und Relief (Rand + Text, wird aufgeklebt)
import * as THREE from "three";
import ClipperLib from "clipper-lib";
import * as opentypeNs from "opentype.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const opentype: any = (opentypeNs as any).parse ? opentypeNs : (opentypeNs as any).default;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Paths = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Font = any;

const S = 1000; // mm -> Clipper-Ganzzahlen
const FONT_BASE = "/fonts/geburt/";

export const LETTER_FONTS = [
  { id: "playfair", label: "Klassisch (Serif, Playfair Black)", file: "playfair-display-900.woff" },
  { id: "abril", label: "Kräftig (Serif, Abril Fatface)", file: "abril-fatface-400.woff" },
  { id: "montserrat", label: "Modern (Sans, Montserrat ExtraBold)", file: "montserrat-800.woff" },
  { id: "fredoka", label: "Rund (Fredoka Bold)", file: "fredoka-700.woff" },
] as const;

/** Nur durchgehend verbundene Schreibschriften; thick = empfohlene Verstärkung der Striche je Seite in mm */
export const NAME_FONTS = [
  { id: "dancing", label: "Dancing Script (kräftig, verspielt)", file: "dancing-script-700.woff", thick: 0.2 },
  { id: "pacifico", label: "Pacifico (rund, kräftig)", file: "pacifico-400.woff", thick: 0 },
  { id: "kaushan", label: "Kaushan Script (Pinsel)", file: "kaushan-script-400.woff", thick: 0.1 },
  { id: "satisfy", label: "Satisfy (elegant)", file: "satisfy-400.woff", thick: 0.5 },
  { id: "yellowtail", label: "Yellowtail (schwungvoll)", file: "yellowtail-400.woff", thick: 0.4 },
  { id: "courgette", label: "Courgette (weich)", file: "courgette-400.woff", thick: 0.3 },
  { id: "greatvibes", label: "Great Vibes (fein, elegant)", file: "great-vibes-400.woff", thick: 0.9 },
  { id: "allura", label: "Allura (fein, geschwungen)", file: "allura-400.woff", thick: 0.9 },
] as const;

const ICON_FONT = "montserrat-800.woff";

export type IconKind = "uhr" | "ballon" | "body" | "gewicht";
export const ICON_KINDS: { kind: IconKind; label: string; placeholder: string; def: string; pos: [number, number] }[] = [
  { kind: "uhr", label: "Uhr (Geburtszeit)", placeholder: "20:32", def: "20:32", pos: [8, 92] },
  { kind: "ballon", label: "Ballon (Geburtsdatum)", placeholder: "19.11.2025", def: "19.11.2025", pos: [92, 92] },
  { kind: "body", label: "Body (Grösse)", placeholder: "52 cm", def: "52 cm", pos: [14, 10] },
  { kind: "gewicht", label: "Paket (Gewicht)", placeholder: "3450 g", def: "3450 g", pos: [88, 12] },
];

export type IconParams = { enabled: boolean; text: string; x: number; y: number };
export type BirthParams = {
  letter: string;
  letterFont: string;
  letterHeight: number; // mm
  depth: number; // mm Tiefe des Buchstabens
  standplatte: boolean;
  name: string;
  nameFont: string;
  nameWidth: number; // % der Buchstabenbreite
  nameX: number; // -50..50 % Verschiebung
  nameY: number; // -50..50 %
  nameAngle: number; // Grad
  nameThick: number; // mm Verstärkung je Seite
  nameHeightMm: number; // Dicke des Namens (mm)
  iconSize: number; // mm
  icons: Record<IconKind, IconParams>;
  pocketDepth: number; // mm
  clearance: number; // mm Spiel
  autoPos: boolean; // Icons automatisch auf dem Buchstaben platzieren (Position = Wunschecke)
};

export const DEFAULT_BIRTH: BirthParams = {
  letter: "M",
  letterFont: "playfair",
  letterHeight: 150,
  depth: 30,
  standplatte: false,
  name: "Marco",
  nameFont: "dancing",
  nameWidth: 95,
  nameX: 0,
  nameY: -8,
  nameAngle: 8,
  nameThick: 0.2,
  nameHeightMm: 4,
  iconSize: 42,
  icons: {
    uhr: { enabled: true, text: "20:32", x: 14, y: 90 },
    ballon: { enabled: true, text: "19.11.2025", x: 88, y: 84 },
    body: { enabled: true, text: "52 cm", x: 16, y: 14 },
    gewicht: { enabled: true, text: "3450 g", x: 86, y: 16 },
  },
  pocketDepth: 2,
  clearance: 0.25,
  autoPos: true,
};

export const BIRTH_LIMITS = {
  letterHeight: [60, 200], depth: [15, 45], nameWidth: [40, 130], nameX: [-50, 50], nameY: [-50, 50], nameAngle: [-25, 25],
  nameThick: [0, 1.5], nameHeightMm: [2, 8], iconSize: [25, 70], pocketDepth: [1, 4], clearance: [0.1, 0.6], pos: [0, 100],
} as const;

// ---------- Schriften ----------
const fontCache = new Map<string, Promise<Font>>();
export type FontLoader = (file: string) => Promise<ArrayBuffer>;
const browserLoader: FontLoader = async (file) => {
  const r = await fetch(FONT_BASE + file);
  if (!r.ok) throw new Error(`Schrift ${file} nicht gefunden (${r.status})`);
  return r.arrayBuffer();
};
export function loadFont(file: string, loader: FontLoader = browserLoader): Promise<Font> {
  const key = file;
  let p = fontCache.get(key);
  if (!p) {
    p = loader(file).then((b) => opentype.parse(b));
    p.catch(() => fontCache.delete(key));
    fontCache.set(key, p);
  }
  return p;
}

// ---------- 2D-Werkzeuge ----------
type Pt = [number, number];
const mkPath = (pts: Pt[]) => pts.map(([x, y]) => ({ X: Math.round(x * S), Y: Math.round(y * S) }));

function run(type: number, subj: Paths, clip?: Paths): Paths {
  const c = new ClipperLib.Clipper();
  c.AddPaths(subj, ClipperLib.PolyType.ptSubject, true);
  if (clip) c.AddPaths(clip, ClipperLib.PolyType.ptClip, true);
  const out = new ClipperLib.Paths();
  c.Execute(type, out, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  return out;
}
export const union = (a: Paths, b?: Paths) => run(ClipperLib.ClipType.ctUnion, a, b);
export const diff = (a: Paths, b: Paths) => run(ClipperLib.ClipType.ctDifference, a, b);
export const inter = (a: Paths, b: Paths) => run(ClipperLib.ClipType.ctIntersection, a, b);
export function offset(p: Paths, mm: number): Paths {
  if (!p.length) return p;
  if (mm === 0) return p;
  const co = new ClipperLib.ClipperOffset(2, 40);
  co.AddPaths(p, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);
  const out = new ClipperLib.Paths();
  co.Execute(out, mm * S);
  return out;
}
export function areaMm2(p: Paths): number {
  let a = 0;
  for (const c of p) a += ClipperLib.Clipper.Area(c);
  return Math.abs(a) / (S * S);
}
export function boundsOf(p: Paths) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const c of p) for (const q of c) { if (q.X < x0) x0 = q.X; if (q.X > x1) x1 = q.X; if (q.Y < y0) y0 = q.Y; if (q.Y > y1) y1 = q.Y; }
  return { x0: x0 / S, x1: x1 / S, y0: y0 / S, y1: y1 / S, w: (x1 - x0) / S, h: (y1 - y0) / S };
}
function mapPaths(p: Paths, f: (x: number, y: number) => Pt): Paths {
  return p.map((c: { X: number; Y: number }[]) => c.map((q) => { const [x, y] = f(q.X / S, q.Y / S); return { X: Math.round(x * S), Y: Math.round(y * S) }; }));
}
const move = (p: Paths, dx: number, dy: number) => mapPaths(p, (x, y) => [x + dx, y + dy]);
const scalePaths = (p: Paths, k: number) => mapPaths(p, (x, y) => [x * k, y * k]);
function rotate(p: Paths, deg: number, cx: number, cy: number) {
  const a = (deg * Math.PI) / 180, co = Math.cos(a), si = Math.sin(a);
  return mapPaths(p, (x, y) => [cx + (x - cx) * co - (y - cy) * si, cy + (x - cx) * si + (y - cy) * co]);
}
const circle = (cx: number, cy: number, r: number, n = 56): Paths => [mkPath(Array.from({ length: n }, (_, i) => [cx + r * Math.cos((i / n) * 2 * Math.PI), cy + r * Math.sin((i / n) * 2 * Math.PI)] as Pt))];
const ellipse = (cx: number, cy: number, rx: number, ry: number, n = 64): Paths => [mkPath(Array.from({ length: n }, (_, i) => [cx + rx * Math.cos((i / n) * 2 * Math.PI), cy + ry * Math.sin((i / n) * 2 * Math.PI)] as Pt))];
const poly = (pts: Pt[]): Paths => [mkPath(pts)];
const rect = (x0: number, y0: number, x1: number, y1: number): Paths => poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
function roundRect(x0: number, y0: number, x1: number, y1: number, r: number): Paths {
  return offset(rect(x0 + r, y0 + r, x1 - r, y1 - r), r);
}

// ---------- Text -> Polygone ----------
function flatten(commands: { type: string; x?: number; y?: number; x1?: number; y1?: number; x2?: number; y2?: number }[], sc: number, ox: number): Pt[][] {
  const out: Pt[][] = [];
  let cur: Pt[] = [];
  let px = 0, py = 0;
  const N = 14;
  const P = (x: number, y: number): Pt => [ox + x * sc, y * sc];
  for (const c of commands) {
    if (c.type === "M") { if (cur.length > 2) out.push(cur); cur = [P(c.x!, c.y!)]; px = c.x!; py = c.y!; }
    else if (c.type === "L") { cur.push(P(c.x!, c.y!)); px = c.x!; py = c.y!; }
    else if (c.type === "Q") {
      for (let i = 1; i <= N; i++) { const t = i / N, u = 1 - t; cur.push(P(u * u * px + 2 * u * t * c.x1! + t * t * c.x!, u * u * py + 2 * u * t * c.y1! + t * t * c.y!)); }
      px = c.x!; py = c.y!;
    } else if (c.type === "C") {
      for (let i = 1; i <= N; i++) { const t = i / N, u = 1 - t; cur.push(P(u * u * u * px + 3 * u * u * t * c.x1! + 3 * u * t * t * c.x2! + t * t * t * c.x!, u * u * u * py + 3 * u * u * t * c.y1! + 3 * u * t * t * c.y2! + t * t * t * c.y!)); }
      px = c.x!; py = c.y!;
    } else if (c.type === "Z") { if (cur.length > 2) out.push(cur); cur = []; }
  }
  if (cur.length > 2) out.push(cur);
  return out;
}

/** Text als Polygone; Grundlinie bei y=0, links bei x=0, Versalhöhe = capMm. Layout von Hand (ohne GSUB), damit alle Schriften gleich funktionieren. */
export function textPaths(font: Font, text: string, capMm: number): Paths {
  const H = font.charToGlyph("H").getBoundingBox();
  const sc = capMm / (H.y2 || font.unitsPerEm * 0.7);
  let x = 0;
  const contours: Pt[][] = [];
  let prev: unknown = null;
  for (const ch of text) {
    const g = font.charToGlyph(ch);
    if (prev) { try { x += (font.getKerningValue(prev, g) || 0) * sc; } catch { /* ohne Kerning */ } }
    contours.push(...flatten(g.path.commands, sc, x));
    x += (g.advanceWidth ?? font.unitsPerEm * 0.3) * sc;
    prev = g;
  }
  if (!contours.length) return [];
  return union(contours.map(mkPath));
}
const centerAt = (p: Paths, cx: number, cy: number) => { const b = boundsOf(p); return move(p, cx - (b.x0 + b.x1) / 2, cy - (b.y0 + b.y1) / 2); };

// ---------- Icons (Entwurf in 100er-Raster, y nach unten) ----------
type IconShape = { plate: Paths; relief: Paths };
function toMm(p: Paths, size: number): Paths { return mapPaths(p, (x, y) => [(x - 50) * (size / 100), (50 - y) * (size / 100)]); }

function iconShape(kind: IconKind, text: string, iconFont: Font, size: number): IconShape {
  const u = size / 100; // mm je Einheit
  let sil: Paths;
  const txt: Paths[] = [];
  const t = (s: string, cap: number, cx: number, cy: number) => { if (s.trim()) txt.push(centerAt(textPaths(iconFont, s, cap * u), cx * u, -(cy - 50) * u)); };
  switch (kind) {
    case "uhr": {
      sil = union(union(circle(50, 55, 36), circle(24, 22, 13)), union(circle(76, 22, 13), union(circle(32, 90, 5), circle(68, 90, 5))));
      t(text, 12, 0, 55);
      break;
    }
    case "ballon": {
      const neck = poly([[32, 66], [68, 66], [60, 86], [40, 86]]);
      sil = union(union(ellipse(50, 38, 34, 38), neck), rect(38, 86, 62, 99));
      const m = text.match(/^(.*?\.)(\d{4})$/);
      if (m) { t(m[1], 11, 0, 31); t(m[2], 11, 0, 48); } else t(text, 11, 0, 38);
      break;
    }
    case "body": {
      const torso = poly([[24, 18], [76, 18], [76, 76], [64, 94], [36, 94], [24, 76]]);
      const l = poly([[25, 18], [4, 32], [11, 48], [25, 40]]);
      const r = poly([[75, 18], [96, 32], [89, 48], [75, 40]]);
      sil = diff(union(union(torso, l), r), circle(50, 14, 9));
      t(text, 9, 0, 58);
      break;
    }
    default: {
      sil = union(union(roundRect(14, 40, 86, 94, 4), roundRect(8, 26, 92, 42, 3)), roundRect(36, 14, 64, 28, 6));
      t(text, 10, 0, 68);
    }
  }
  const lw = 3.2;
  const rim = diff(sil, offset(sil, -lw * 1));
  const silMm = toMm(sil, size);
  const rimMm = toMm(rim, size);
  const textMm = txt.length ? offset(union(txt.flat()), 0.12) : [];
  const relief = union(rimMm, textMm.length ? inter(textMm, offset(silMm, -0.4)) : undefined);
  void u;
  return { plate: silMm, relief };
}

// ---------- Aufbau ----------
export type Part = { id: string; label: string; color: "weiss" | "gold"; positions: Float32Array; volume: number; dims: { x: number; y: number; z: number } };
export type Layer2D = { id: string; label: string; color: "weiss" | "gold"; paths: Paths; z: number };
export type BirthResult = {
  parts: Part[];
  layers: Layer2D[]; // für die 2D-Ansicht, von unten nach oben
  bounds: { x0: number; x1: number; y0: number; y1: number };
  warnings: string[];
  depth: number;
};

function shapesFromPaths(p: Paths): THREE.Shape[] {
  const c = new ClipperLib.Clipper();
  c.AddPaths(p, ClipperLib.PolyType.ptSubject, true);
  const tree = new ClipperLib.PolyTree();
  c.Execute(ClipperLib.ClipType.ctUnion, tree, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  const shapes: THREE.Shape[] = [];
  const toV = (path: { X: number; Y: number }[]) => path.map((q) => new THREE.Vector2(q.X / S, q.Y / S));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const walkTop = (node: any) => {
    for (const ch of node.Childs()) {
      if (ch.IsHole()) { walkTop(ch); continue; }
      const sh = new THREE.Shape(toV(ch.Contour()));
      for (const h of ch.Childs()) { sh.holes.push(new THREE.Path(toV(h.Contour()))); walkTop(h); }
      shapes.push(sh);
    }
  };
  walkTop(tree);
  return shapes;
}

function extrude(p: Paths, z0: number, z1: number): Float32Array[] {
  if (!p.length || z1 <= z0) return [];
  const shapes = shapesFromPaths(p);
  if (!shapes.length) return [];
  const g = new THREE.ExtrudeGeometry(shapes, { depth: z1 - z0, bevelEnabled: false, curveSegments: 1, steps: 1 });
  g.translate(0, 0, z0);
  const out = g.getAttribute("position").array as Float32Array;
  g.dispose();
  return [Float32Array.from(out)];
}

function mergeF32(list: Float32Array[]): Float32Array {
  const n = list.reduce((a, b) => a + b.length, 0);
  const out = new Float32Array(n);
  let o = 0;
  for (const a of list) { out.set(a, o); o += a.length; }
  return out;
}
function volumeOf(pos: Float32Array): number {
  let v = 0;
  for (let i = 0; i < pos.length; i += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = [pos[i], pos[i + 1], pos[i + 2], pos[i + 3], pos[i + 4], pos[i + 5], pos[i + 6], pos[i + 7], pos[i + 8]];
    v += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
  }
  return Math.abs(v);
}
function dimsOf(pos: Float32Array) {
  const a = [Infinity, Infinity, Infinity], b = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) { a[k] = Math.min(a[k], pos[i + k]); b[k] = Math.max(b[k], pos[i + k]); }
  return { x: b[0] - a[0], y: b[1] - a[1], z: b[2] - a[2] };
}
function mkPart(id: string, label: string, color: "weiss" | "gold", chunks: Float32Array[]): Part | null {
  const positions = mergeF32(chunks);
  if (!positions.length) return null;
  return { id, label, color, positions, volume: volumeOf(positions), dims: dimsOf(positions) };
}

export function clampBirth(p: BirthParams): BirthParams {
  const c = (v: number, [a, b]: readonly [number, number]) => Math.min(b, Math.max(a, Number.isFinite(v) ? v : a));
  const L = BIRTH_LIMITS;
  const icons = { ...p.icons };
  for (const k of Object.keys(icons) as IconKind[]) icons[k] = { ...icons[k], x: c(icons[k].x, L.pos), y: c(icons[k].y, L.pos) };
  return {
    ...p, autoPos: !!p.autoPos, icons,
    letter: ([...p.letter][0] ?? "M"),
    letterHeight: c(p.letterHeight, L.letterHeight), depth: c(p.depth, L.depth), nameWidth: c(p.nameWidth, L.nameWidth),
    nameX: c(p.nameX, L.nameX), nameY: c(p.nameY, L.nameY), nameAngle: c(p.nameAngle, L.nameAngle), nameThick: c(p.nameThick, L.nameThick),
    nameHeightMm: c(p.nameHeightMm, L.nameHeightMm), iconSize: c(p.iconSize, L.iconSize), pocketDepth: c(p.pocketDepth, L.pocketDepth), clearance: c(p.clearance, L.clearance),
  };
}

export async function buildBirth(input: BirthParams, loader?: FontLoader): Promise<BirthResult | null> {
  const p = clampBirth(input);
  const lf = LETTER_FONTS.find((f) => f.id === p.letterFont) ?? LETTER_FONTS[0];
  const nf = NAME_FONTS.find((f) => f.id === p.nameFont) ?? NAME_FONTS[0];
  const [letterFont, nameFont, iconFont] = await Promise.all([loadFont(lf.file, loader), loadFont(nf.file, loader), loadFont(ICON_FONT, loader)]);
  const warnings: string[] = [];
  const ch = p.letter.trim();
  if (!ch) return null;

  // Buchstabe: Breite x zentriert, Unterkante y=0
  const raw = textPaths(letterFont, ch, p.letterHeight);
  if (!raw.length) { warnings.push(`Der Buchstabe "${ch}" ist in dieser Schrift nicht vorhanden.`); return null; }
  let b = boundsOf(raw);
  let letter: Paths = move(raw, -(b.x0 + b.x1) / 2, -b.y0);
  b = boundsOf(letter);
  if (p.standplatte) letter = union(letter, roundRect(b.x0 - 2, -0.5, b.x1 + 2, 7, 2));
  b = boundsOf(letter);
  const LW = b.w, LH = b.h, cx = (b.x0 + b.x1) / 2;

  // Name
  const pd = p.pocketDepth;
  let name: Paths = [];
  if (p.name.trim()) {
    const base = textPaths(nameFont, p.name.trim(), 100);
    if (base.length) {
      const bb = boundsOf(base);
      const k = ((LW * p.nameWidth) / 100) / bb.w;
      let n = scalePaths(base, k);
      n = offset(n, p.nameThick);
      n = centerAt(n, 0, 0);
      n = rotate(n, p.nameAngle, 0, 0);
      n = move(n, cx + (p.nameX / 100) * LW, LH / 2 + (p.nameY / 100) * LH);
      name = n;
      const nb = boundsOf(name);
      if (nb.h < 8) warnings.push("Der Name ist sehr klein; Striche werden dünn. Mehr Breite oder kürzeren Namen wählen.");
      const comps = shapesFromPaths(name).length;
      if (comps > 1) warnings.push(`Der Name besteht aus ${comps} Einzelteilen (z. B. i-Punkt oder Umlaut-Punkte): einzeln einkleben.`);
      const cover = areaMm2(inter(offset(name, p.clearance), letter)) / Math.max(1, areaMm2(name));
      if (cover < 0.5) warnings.push("Der Name liegt grossteils ausserhalb des Buchstabens: Breite oder Position anpassen, damit er auf dem Buchstaben aufliegt.");
    }
  }

  // Icons
  type IconBuilt = { kind: IconKind; label: string; plate: Paths; relief: Paths };
  const icons: IconBuilt[] = [];
  for (const meta of ICON_KINDS) {
    const ip = p.icons[meta.kind];
    if (!ip.enabled) continue;
    const sh = iconShape(meta.kind, ip.text, iconFont, p.iconSize);
    let ox = b.x0 + (ip.x / 100) * LW, oy = b.y0 + (ip.y / 100) * LH;
    if (p.autoPos) {
      // Wunschposition als Anker: nächstgelegene Stelle suchen, die ganz auf dem Buchstaben liegt und nichts anderes berührt
      const taken: Paths = [...(name.length ? offset(name, p.clearance + 1) : []), ...icons.flatMap((q) => offset(q.plate, 1))];
      const area0 = Math.max(1, areaMm2(sh.plate));
      let best = null as { sc: number; x: number; y: number } | null;
      for (const minCov of [0.93, 0.75, 0.55]) {
      for (let gy = 0; gy <= 100; gy += 5) for (let gx = 0; gx <= 100; gx += 5) {
        const px = b.x0 + (gx / 100) * LW, py = b.y0 + (gy / 100) * LH;
        const pp = move(sh.plate, px, py);
        const cov = areaMm2(inter(pp, letter)) / area0;
        if (cov < minCov) continue;
        const ov = taken.length ? areaMm2(inter(pp, taken)) : 0;
        if (ov > 2) continue;
        const sc = Math.hypot(gx - ip.x, gy - ip.y);
        if (!best || sc < best.sc) best = { sc, x: px, y: py };
      }
      if (best) break;
      }
      if (best) { ox = best.x; oy = best.y; }
    }
    const plate = move(sh.plate, ox, oy), relief = move(sh.relief, ox, oy);
    const cover = areaMm2(inter(plate, letter)) / Math.max(1, areaMm2(plate));
    if (cover < 0.45) warnings.push(`${meta.label}: liegt kaum auf dem Buchstaben (nur ${Math.round(cover * 100)} %). Position anpassen, sonst gibt es keine Mulde zum Einkleben.`);
    else if (cover < 0.9) warnings.push(`${meta.label}: ragt teilweise über den Buchstaben; die Mulde ist dort offen.`);
    icons.push({ kind: meta.kind, label: meta.label, plate, relief });
  }

  // Mulden aus der Vorderseite schneiden (Spiel rundum)
  let pockets: Paths = name.length ? offset(name, p.clearance) : [];
  for (const i of icons) pockets = pockets.length ? union(pockets, offset(i.plate, p.clearance)) : offset(i.plate, p.clearance);
  const slab = pockets.length ? diff(letter, pockets) : letter;
  const D = p.depth;
  const letterChunks = [...extrude(letter, 0, D - pd), ...extrude(slab, D - pd, D)];
  const parts: Part[] = [];
  const layers: Layer2D[] = [{ id: "buchstabe", label: "Buchstabe", color: "weiss", paths: slab, z: D }];
  const pl = mkPart("buchstabe", `Buchstabe ${ch}`, "weiss", letterChunks);
  if (pl) parts.push(pl);
  if (name.length) {
    const np = mkPart("name", `Name ${p.name.trim()}`, "gold", extrude(name, D - pd, D - pd + p.nameHeightMm));
    if (np) parts.push(np);
    layers.push({ id: "name", label: "Name", color: "gold", paths: name, z: D + p.nameHeightMm - pd });
  }
  for (const i of icons) {
    const a = mkPart(`${i.kind}-platte`, `${i.label}: Platte`, "weiss", extrude(i.plate, D - pd, D));
    const r = mkPart(`${i.kind}-relief`, `${i.label}: Relief`, "gold", extrude(i.relief, D, D + 1.2));
    if (a) parts.push(a);
    if (r) parts.push(r);
    layers.push({ id: `${i.kind}-platte`, label: `${i.label}`, color: "weiss", paths: i.plate, z: D });
    layers.push({ id: `${i.kind}-relief`, label: `${i.label} Relief`, color: "gold", paths: i.relief, z: D + 1.2 });
  }
  if (!parts.length) return null;
  return { parts, layers, bounds: { x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1 }, warnings, depth: D };
}

/** Binäres STL aus nicht indizierten Dreiecken */
export function trianglesToStl(positions: Float32Array, header = "3DMuscio Namensbuchstabe"): ArrayBuffer {
  const n = positions.length / 9;
  const buf = new ArrayBuffer(84 + n * 50);
  const dv = new DataView(buf);
  for (let i = 0; i < header.length; i++) dv.setUint8(i, header.charCodeAt(i));
  dv.setUint32(80, n, true);
  let off = 84;
  for (let t = 0; t < n; t++) {
    const o = t * 9;
    const ux = positions[o + 3] - positions[o], uy = positions[o + 4] - positions[o + 1], uz = positions[o + 5] - positions[o + 2];
    const vx = positions[o + 6] - positions[o], vy = positions[o + 7] - positions[o + 1], vz = positions[o + 8] - positions[o + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    dv.setFloat32(off, nx, true); dv.setFloat32(off + 4, ny, true); dv.setFloat32(off + 8, nz, true);
    off += 12;
    for (let k = 0; k < 9; k++) { dv.setFloat32(off, positions[o + k], true); off += 4; }
    dv.setUint16(off, 0, true);
    off += 2;
  }
  return buf;
}

/** SVG-Pfad (y nach oben in mm -> SVG über transform spiegeln) */
export function pathsToD(p: Paths): string {
  return p.map((c: { X: number; Y: number }[]) => "M" + c.map((q) => `${(q.X / S).toFixed(2)} ${(q.Y / S).toFixed(2)}`).join("L") + "Z").join("");
}
