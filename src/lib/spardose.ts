// Spardose-Generator (TESTVERSION): Name -> hohle Spardose mit Münzschlitz, Einleger-Buchstaben und Bajonett-Kappe.
// Alles läuft im Browser. Ohne CSG-Bibliothek: Der Körper wird aus Schichten (z-Scheiben) aufgebaut,
// jede Scheibe ist eine 2D-Maske (Distanzfeld) die per Marching Squares in Polygone umgewandelt wird.
// Koordinaten "Druckrichtung": Vorderseite liegt bei z = 0 (auf dem Druckbett), die Rückseite bei z = Tiefe.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type SpardoseParams = {
  name: string;
  font: string;
  spacing: number; // Buchstabenabstand mm
  maxLength: number; // maximale Gesamtlänge mm
  size: number; // Buchstabenhöhe mm
  rand: number; // Körper-Rand um die Buchstaben mm
  wand: number; // Wandstärke mm
  tiefe: number; // Tiefe der Dose mm
  rillen: boolean;
  schlitzX: number; // Position des Münzschlitzes in mm von der Mitte (nach rechts +)
  rillenAbstand: number; // mm
  rillenTiefe: number; // mm
  spiel: number; // Passungsspiel mm
  taschenTiefe: number; // Tiefe der Vertiefung für Buchstaben mm
  ueberstand: number; // Buchstaben stehen so weit vor mm
};

// 5-Franken-Stück (grösste Schweizer Münze, Swissmint): Ø 31,45 mm, Dicke 2,35 mm
// Schlitz: Durchmesser + 2 mm (je 1 mm pro Seite), Dicke + 1 mm je Seite
export const COIN = { d: 31.45, t: 2.35 };
export const SLOT_LEN = +(COIN.d + 2).toFixed(2); // 33,45 mm, längs in der Tiefe
export const SLOT_THK = +(COIN.t + 2).toFixed(2); // 4,35 mm, in x

// Grenzen: Kunden können nur Werte wählen, mit denen die Spardose sicher funktioniert
export const LIMITS = {
  spacing: [0, 10], maxLength: [120, 300], size: [30, 75], rand: [3, 12], wand: [2, 4],
  tiefe: [50, 80], spiel: [0.2, 0.4], taschenTiefe: [1.5, 3], ueberstand: [0.5, 2.5],
  rillenAbstand: [1, 3], rillenTiefe: [0.2, 0.6], schlitzX: [-60, 60],
} as const;
export const NAME_MIN = 2;

const clampP = (v: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));
export function clampParams(p: SpardoseParams): SpardoseParams {
  return {
    ...p,
    spacing: clampP(p.spacing, LIMITS.spacing), maxLength: clampP(p.maxLength, LIMITS.maxLength), size: clampP(p.size, LIMITS.size),
    rand: clampP(p.rand, LIMITS.rand), wand: clampP(p.wand, LIMITS.wand), tiefe: clampP(p.tiefe, LIMITS.tiefe),
    spiel: clampP(p.spiel, LIMITS.spiel), taschenTiefe: clampP(p.taschenTiefe, LIMITS.taschenTiefe), ueberstand: clampP(p.ueberstand, LIMITS.ueberstand),
    rillenAbstand: clampP(p.rillenAbstand, LIMITS.rillenAbstand), rillenTiefe: clampP(p.rillenTiefe, LIMITS.rillenTiefe),
    schlitzX: Math.min(LIMITS.schlitzX[1], Math.max(LIMITS.schlitzX[0], Number.isFinite(p.schlitzX) ? p.schlitzX : 0)),
  };
}

export const DEFAULTS: SpardoseParams = {
  name: "Nora",
  font: "Fredoka",
  spacing: 0,
  maxLength: 255,
  size: 40,
  rand: 8,
  wand: 2.4,
  tiefe: 50,
  rillen: true,
  schlitzX: 0,
  rillenAbstand: 1.2,
  rillenTiefe: 0.4,
  spiel: 0.25,
  taschenTiefe: 2,
  ueberstand: 1.5,
};

export const FONTS: { id: string; label: string; css: string }[] = [
  { id: "Fredoka", label: "Rund (Fredoka)", css: '700 {px}px "Fredoka"' },
  { id: "Baloo 2", label: "Weich (Baloo)", css: '800 {px}px "Baloo 2"' },
  { id: "Lilita One", label: "Kräftig (Lilita)", css: '400 {px}px "Lilita One"' },
  { id: "Chewy", label: "Verspielt (Chewy)", css: '400 {px}px "Chewy"' },
];

export const FONT_CSS_URL =
  "https://fonts.googleapis.com/css2?family=Fredoka:wght@700&family=Baloo+2:wght@800&family=Lilita+One&family=Chewy&display=swap";

export type SpardoseResult = {
  name: string;
  body: THREE.BufferGeometry;
  letters: THREE.BufferGeometry;
  cap: THREE.BufferGeometry;
  capPose: { x: number; y: number; z: number };
  dims: { x: number; y: number; z: number };
  warnings: string[];
  info: { sizeUsed: number; capR: number; kammern: number; ppm: number; randUsed: number };
  valid: boolean;
};

export function sanitizeName(s: string) {
  // keine Sonderzeichen und keine Leerzeichen (ein Leerzeichen würde den Körper trennen): nur A-Z, a-z, 0-9
  return s.replace(/[^A-Za-z0-9]/g, "").slice(0, 12);
}

let fontsRequested = false;
export async function loadFonts() {
  if (typeof document === "undefined") return;
  if (!fontsRequested) {
    fontsRequested = true;
    if (!document.querySelector(`link[data-spardose-fonts]`)) {
      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = FONT_CSS_URL;
      l.setAttribute("data-spardose-fonts", "1");
      document.head.appendChild(l);
    }
  }
  try {
    await Promise.all(FONTS.map((f) => document.fonts.load(f.css.replace("{px}", "40"), "AaBb")));
  } catch {
    /* Schrift-Fallback */
  }
}

// ---------- Distanztransformation (exakt, Felzenszwalb) ----------
function edt(f: Float32Array, w: number, h: number): Float32Array {
  const INF = 1e12;
  const n = Math.max(w, h);
  const d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1), col = new Float64Array(n);
  const out = new Float32Array(w * h);
  const pass = (len: number, get: (i: number) => number, set: (i: number, val: number) => void) => {
    for (let i = 0; i < len; i++) col[i] = get(i);
    let k = 0;
    v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < len; q++) {
      let s = (col[q] + q * q - (col[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) {
        k--;
        s = (col[q] + q * q - (col[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      }
      k++;
      v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < len; q++) {
      while (z[k + 1] < q) k++;
      d[q] = (q - v[k]) * (q - v[k]) + col[v[k]];
    }
    for (let i = 0; i < len; i++) set(i, d[i]);
  };
  const tmp = new Float32Array(w * h);
  for (let x = 0; x < w; x++) pass(h, (y) => f[y * w + x], (y, val) => { tmp[y * w + x] = Math.min(val, INF); });
  for (let y = 0; y < h; y++) pass(w, (x) => tmp[y * w + x], (x, val) => { out[y * w + x] = val; });
  return out;
}

// ---------- Marching Squares -> Polygone ----------
type Pt = [number, number];

function contours(field: Float32Array, w: number, h: number): Pt[][] {
  // Segmente je Zelle, verknüpft über Kanten-Schlüssel
  const segA: number[] = [], segB: number[] = [];
  const pos = new Map<number, Pt>();
  const edgeH = (x: number, y: number) => (y * w + x) * 2; // Kante (x,y)-(x+1,y)
  const edgeV = (x: number, y: number) => (y * w + x) * 2 + 1; // Kante (x,y)-(x,y+1)
  const pointOf = (key: number): Pt => {
    let p = pos.get(key);
    if (p) return p;
    const vert = key & 1, idx = key >> 1, y = Math.floor(idx / w), x = idx - y * w;
    if (vert === 0) {
      const a = field[y * w + x], b = field[y * w + x + 1];
      p = [x + a / (a - b), y];
    } else {
      const a = field[y * w + x], b = field[(y + 1) * w + x];
      p = [x, y + a / (a - b)];
    }
    pos.set(key, p);
    return p;
  };
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const a = field[y * w + x], b = field[y * w + x + 1], c = field[(y + 1) * w + x + 1], d = field[(y + 1) * w + x];
      const ci = (a < 0 ? 1 : 0) | (b < 0 ? 2 : 0) | (c < 0 ? 4 : 0) | (d < 0 ? 8 : 0);
      if (ci === 0 || ci === 15) continue;
      const T = edgeH(x, y), R = edgeV(x + 1, y), B = edgeH(x, y + 1), L = edgeV(x, y);
      const add = (p: number, q: number) => { segA.push(p); segB.push(q); };
      switch (ci) {
        case 1: case 14: add(L, T); break;
        case 2: case 13: add(T, R); break;
        case 3: case 12: add(L, R); break;
        case 4: case 11: add(R, B); break;
        case 6: case 9: add(T, B); break;
        case 7: case 8: add(L, B); break;
        case 5: {
          const inside = (a + b + c + d) / 4 < 0;
          if (inside) { add(T, R); add(L, B); } else { add(L, T); add(R, B); }
          break;
        }
        case 10: {
          const inside = (a + b + c + d) / 4 < 0;
          if (inside) { add(L, T); add(R, B); } else { add(T, R); add(L, B); }
          break;
        }
      }
    }
  }
  const adj = new Map<number, number[]>();
  for (let i = 0; i < segA.length; i++) {
    (adj.get(segA[i]) ?? adj.set(segA[i], []).get(segA[i])!).push(i);
    (adj.get(segB[i]) ?? adj.set(segB[i], []).get(segB[i])!).push(i);
  }
  const used = new Uint8Array(segA.length);
  const loops: Pt[][] = [];
  for (let s = 0; s < segA.length; s++) {
    if (used[s]) continue;
    used[s] = 1;
    const startKey = segA[s];
    let cur = segB[s];
    const loop: Pt[] = [pointOf(startKey)];
    let guard = 0;
    while (cur !== startKey && guard++ < 5_000_000) {
      loop.push(pointOf(cur));
      const next = (adj.get(cur) ?? []).find((i) => !used[i]);
      if (next === undefined) break;
      used[next] = 1;
      cur = segA[next] === cur ? segB[next] : segA[next];
    }
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}

function rdp(pts: Pt[], eps: number): Pt[] {
  // geschlossene Kontur vereinfachen (iterativ)
  if (pts.length < 8) return pts;
  const n = pts.length;
  // zwei Ankerpunkte: erster und weitester Punkt
  let far = 0, best = -1;
  for (let i = 1; i < n; i++) {
    const dx = pts[i][0] - pts[0][0], dy = pts[i][1] - pts[0][1];
    const dd = dx * dx + dy * dy;
    if (dd > best) { best = dd; far = i; }
  }
  const keep = new Uint8Array(n);
  keep[0] = 1; keep[far] = 1;
  const stack: [number, number][] = [[0, far], [far, n]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    const A = pts[s], B = pts[e % n];
    const dx = B[0] - A[0], dy = B[1] - A[1];
    const len = Math.hypot(dx, dy) || 1e-9;
    let md = -1, mi = -1;
    for (let i = s + 1; i < e; i++) {
      const P = pts[i];
      const dist = Math.abs((P[0] - A[0]) * dy - (P[1] - A[1]) * dx) / len;
      if (dist > md) { md = dist; mi = i; }
    }
    if (md > eps && mi > 0) {
      keep[mi] = 1;
      stack.push([s, mi], [mi, e]);
    }
  }
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i]);
  return out.length >= 3 ? out : pts;
}

function area(p: Pt[]) {
  let a = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]);
  return a / 2;
}
function inside(pt: Pt, poly: Pt[]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

function toShapes(loops: Pt[][], map: (p: Pt) => THREE.Vector2, epsPx: number): THREE.Shape[] {
  const polys = loops.map((l) => rdp(l, epsPx)).filter((l) => l.length >= 3);
  const ar = polys.map((p) => Math.abs(area(p)));
  const depth = polys.map((p, i) => {
    let d = 0;
    for (let j = 0; j < polys.length; j++) if (j !== i && ar[j] > ar[i] && inside(p[0], polys[j])) d++;
    return d;
  });
  const shapes = new Map<number, THREE.Shape>();
  polys.forEach((p, i) => {
    if (depth[i] % 2 === 0) shapes.set(i, new THREE.Shape(p.map(map)));
  });
  polys.forEach((p, i) => {
    if (depth[i] % 2 === 1) {
      let parent = -1, pa = Infinity;
      for (let j = 0; j < polys.length; j++) {
        if (depth[j] === depth[i] - 1 && shapes.has(j) && ar[j] > ar[i] && ar[j] < pa && inside(p[0], polys[j])) { parent = j; pa = ar[j]; }
      }
      if (parent >= 0) shapes.get(parent)!.holes.push(new THREE.Path(p.map(map)));
    }
  });
  return [...shapes.values()];
}

// ---------- Hauptfunktion ----------
export async function generateSpardose(pIn: SpardoseParams): Promise<SpardoseResult | null> {
  const base = clampParams(pIn);
  if (sanitizeName(base.name).length < NAME_MIN) return null;
  // Rand automatisch erhöhen, bis Hohlraum, Schlitz und Kappe sicher funktionieren
  let rand = base.rand, last: SpardoseResult | null = null;
  for (let i = 0; i < 10; i++) {
    const r = await buildSpardose({ ...base, rand });
    if (!r) return null;
    if (last) { last.body.dispose(); last.letters.dispose(); last.cap.dispose(); }
    last = r;
    if (r.valid || rand >= LIMITS.rand[1]) break;
    rand = Math.min(LIMITS.rand[1], Math.max(rand + 1, 7)); // erster Sprung direkt auf 7 mm (spart Rechenzeit)
  }
  const res = last!;
  if (res.valid && rand > base.rand) res.warnings.unshift(`Rand automatisch von ${base.rand} auf ${rand} mm erhöht, damit Hohlraum, Münzschlitz und Kappe funktionieren.`);
  if (!res.valid) res.warnings.unshift("Mit diesem Namen und diesen Einstellungen funktioniert die Spardose nicht sicher. Längeren Namen oder grössere Buchstaben wählen.");
  return res;
}

async function buildSpardose(p: SpardoseParams): Promise<SpardoseResult | null> {
  const name = sanitizeName(p.name).trim();
  if (!name) return null;
  const font = FONTS.find((f) => f.id === p.font) ?? FONTS[0];
  await loadFonts();
  const warnings: string[] = [];
  const chars = [...name];
  const fontStr = (px: number) => font.css.replace("{px}", String(px));

  const meas = document.createElement("canvas").getContext("2d")!;
  meas.font = fontStr(200);
  const capRatio = meas.measureText("H").actualBoundingBoxAscent / 200 || 0.7;
  meas.font = fontStr(100);
  const adv100 = chars.map((c) => meas.measureText(c).width);
  const sumAdv = adv100.reduce((a, b) => a + b, 0) / 100;
  const fixed = p.spacing * (chars.length - 1);
  let size = p.size;
  const widthMm = (sz: number) => (sumAdv * sz) / capRatio + fixed;
  if (widthMm(size) + 2 * p.rand > p.maxLength) {
    size = Math.max(LIMITS.size[0], (p.maxLength - 2 * p.rand - fixed) / (sumAdv / capRatio));
    warnings.push(`Name ist zu lang: Buchstabenhöhe automatisch auf ${size.toFixed(0)} mm verkleinert (max. Länge ${p.maxLength} mm).`);
  }

  // Raster aufbauen (Auflösung reduzieren bei sehr langen Namen)
  let ppm = 4, W = 0, H = 0, padPx = 0, asc = 0, desc = 0, fontPx = 0;
  for (const tryPpm of [4, 3, 2]) {
    ppm = tryPpm;
    fontPx = (size / capRatio) * ppm;
    meas.font = fontStr(fontPx);
    asc = 0; desc = 0;
    for (const c of chars) {
      const m = meas.measureText(c);
      asc = Math.max(asc, m.actualBoundingBoxAscent);
      desc = Math.max(desc, m.actualBoundingBoxDescent);
    }
    padPx = Math.ceil((p.rand + 10) * ppm);
    W = Math.ceil(widthMm(size) * ppm) + 2 * padPx + 8;
    H = Math.ceil(asc + desc) + 2 * padPx;
    if (W * H <= 3_200_000) break;
  }
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#000";
  ctx.font = fontStr(fontPx);
  ctx.textBaseline = "alphabetic";
  ctx.setTransform(-1, 0, 0, 1, W, 0); // gespiegelt: Druckrichtung (Vorderseite liegt auf dem Bett)
  let xx = padPx + 4;
  chars.forEach((c, i) => {
    ctx.fillText(c, xx, padPx + asc);
    xx += (adv100[i] / 100) * fontPx + p.spacing * ppm;
  });
  const img = ctx.getImageData(0, 0, W, H).data;
  const N = W * H;
  const tf = new Float32Array(N);
  const seed = new Float32Array(N);
  let minX = W, maxX = 0;
  for (let i = 0; i < N; i++) {
    const a = img[i * 4 + 3];
    tf[i] = 0.5 - a / 255;
    if (a >= 128) {
      seed[i] = 0;
      const x = i % W;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    } else seed[i] = 1e12;
  }
  if (maxX <= minX) return null;
  const dt = edt(seed, W, H);
  const sd = new Float32Array(N);
  for (let i = 0; i < N; i++) sd[i] = Math.sqrt(dt[i]);

  const Rpx = p.rand * ppm, wallPx = p.wand * ppm, clrPx = p.spiel * ppm;
  const cxPx = (minX + maxX) / 2;
  const cxMm = cxPx / ppm;
  const toMm = (pt: Pt) => new THREE.Vector2(pt[0] / ppm - cxMm, (H - pt[1]) / ppm - H / ppm / 2);
  const epsPx = 0.035 * ppm;

  // Hohlraum: Kammern und größter Innenkreis (für die Kappe)
  const lab = new Int32Array(N);
  let nLab = 0;
  const sizes: number[] = [0];
  const queue = new Int32Array(N);
  for (let i = 0; i < N; i++) {
    if (lab[i] || sd[i] - Rpx + wallPx >= 0) continue;
    nLab++;
    let qh = 0, qt = 0, cnt = 0;
    queue[qt++] = i; lab[i] = nLab;
    while (qh < qt) {
      const cur = queue[qh++]; cnt++;
      const x = cur % W;
      const nb = [x > 0 ? cur - 1 : -1, x < W - 1 ? cur + 1 : -1, cur >= W ? cur - W : -1, cur < N - W ? cur + W : -1];
      for (const q of nb) if (q >= 0 && !lab[q] && sd[q] - Rpx + wallPx < 0) { lab[q] = nLab; queue[qt++] = q; }
    }
    sizes.push(cnt);
  }
  const minArea = 9 * ppm * ppm * 4;
  const kammern = sizes.filter((s, i) => i > 0 && s > minArea).length;
  let big = 1;
  for (let i = 2; i < sizes.length; i++) if (sizes[i] > sizes[big]) big = i;
  if (nLab === 0) warnings.push("Kein Hohlraum entstanden: Rand oder Buchstaben sind zu klein. Rand oder Buchstabenhöhe erhöhen.");
  if (kammern > 1) warnings.push(`Der Hohlraum ist in ${kammern} getrennte Kammern geteilt (Schrift stellenweise zu dünn). Rand erhöhen oder Wand verkleinern.`);
  // echter Innenradius (Abstand zur nächsten Wand) für die Kappenposition
  const cavSeed = new Float32Array(N);
  for (let i = 0; i < N; i++) cavSeed[i] = lab[i] === big ? 1e12 : 0;
  const rhoSq = edt(cavSeed, W, H);
  let rhoMax = 0;
  for (let i = 0; i < N; i++) if (lab[i] === big) rhoMax = Math.max(rhoMax, Math.sqrt(rhoSq[i]));
  let capXpx = cxPx, capYpx = H / 2, bestDx = Infinity;
  for (let i = 0; i < N; i++) {
    if (lab[i] !== big) continue;
    const rho = Math.sqrt(rhoSq[i]);
    if (rho >= rhoMax * 0.97) {
      const dx = Math.abs((i % W) - cxPx);
      if (dx < bestDx) { bestDx = dx; capXpx = i % W; capYpx = Math.floor(i / W); }
    }
  }
  // Kappe: Masse nach Vorgabe (Ø30 Hals, Ø36 Konus-Bund, Höhe 7,5, zwei Nasen 1,5 x 2,4, Steg quer dazu), mindestens 12 % grösser
  const CAP = { r: 15, rFl: 18, rLug: 16.5, lugW: 2.4, lugH: 3.46, h: 7.5, neckTop: 5.0, floor: 4.96, rRec: 11.5 };
  // Die Öffnung muss das 5-Franken-Stück IMMER durchlassen: Lochdurchmesser >= Münzdurchmesser + 2 mm.
  // Die Kappe wird dafür nie kleiner skaliert (Mindestfaktor), stattdessen wird der Rand erhöht (siehe Wrapper).
  const rhoC = rhoMax / ppm;
  const kc = Math.max(1.12, ((COIN.d + 2) / 2 - p.spiel) / CAP.r + 0.01);
  const kapOk = rhoC - 0.4 - p.spiel >= CAP.r * kc && rhoC + p.wand - 1.2 - p.spiel >= CAP.rFl * kc;

  // Münzschlitz: oben, Position einstellbar (0 = Mitte), lang in der Tiefe, schmal in x, mit runden Enden.
  // Die Position wird automatisch auf die nächste Stelle gesetzt, unter der ein Hohlraum liegt.
  const hwPx = (SLOT_THK / 2) * ppm;
  const colsInfo = (cxc: number) => {
    let bottom = -1, missing = 0;
    for (let x = Math.max(0, Math.round(cxc - hwPx)); x <= Math.min(W - 1, Math.round(cxc + hwPx)); x++) {
      let top = -1;
      for (let y = 0; y < H; y++) if (lab[y * W + x] === big) { top = y; break; }
      if (top < 0) missing++;
      else bottom = Math.max(bottom, top);
    }
    return { bottom, missing };
  };
  const wantX = Math.round(cxPx - p.schlitzX * ppm); // Raster ist gespiegelt
  let slotCx = wantX, slotInfo = colsInfo(wantX), slotAdjusted = false;
  if (slotInfo.missing > 0 || slotInfo.bottom < 0) {
    slotInfo = { bottom: -1, missing: 1 };
    for (let d = 1; d < W && slotInfo.bottom < 0; d++) {
      for (const sg of [1, -1]) {
        const c = wantX + sg * d;
        if (c < hwPx || c > W - hwPx) continue;
        const inf = colsInfo(c);
        if (inf.missing === 0 && inf.bottom >= 0) { slotCx = c; slotInfo = inf; slotAdjusted = true; break; }
      }
    }
  }
  const slotBottom = slotInfo.bottom, colsNoCavity = slotInfo.missing;
  if (slotBottom < 0) warnings.push("Kein Hohlraum für den Münzschlitz gefunden.");
  else if (slotAdjusted) warnings.push("Die Schlitzposition wurde automatisch verschoben, weil dort kein Hohlraum liegt.");

  // Z-Aufbau
  const P = p.taschenTiefe;
  const F = P + 2;
  // Rückwand von aussen nach innen: Konus-Senkung (2,5) -> Hals (1,3) -> Nut für die Nasen (3,9)
  const GAP = 0.2, CONEH = CAP.h - CAP.neckTop, NECKT = 1.3;
  const GRT = CAP.lugH + 0.44;
  const Bk = GAP + CAP.h;
  const Ls = SLOT_LEN;
  const D = Math.max(p.tiefe, F + Bk + Ls + 4);
  const zs = (F + (D - Bk)) / 2 - Ls / 2;
  const NCONE = 8;
  const pitch = Math.max(0.6, p.rillenAbstand), gw = pitch / 3;
  const grooves: [number, number][] = [];
  if (p.rillen) for (let k = 1; k * pitch <= D - 1; k++) if (k * pitch - gw >= 1) grooves.push([k * pitch - gw, k * pitch]);
  const SLR = SLOT_THK / 2, NS = 6;
  const bps = new Set<number>([0, P, F, zs, zs + Ls, D - Bk, D - Bk + GRT, D - CONEH]);
  for (let i = 1; i < NS; i++) { bps.add(zs + (SLR * i) / NS); bps.add(zs + Ls - (SLR * i) / NS); }
  for (let i = 0; i <= NCONE; i++) bps.add(D - CONEH + (CONEH * i) / NCONE);
  grooves.forEach(([a, b]) => { bps.add(a); bps.add(b); });
  const zlist = [...bps].filter((z) => z >= 0 && z <= D).sort((a, b) => a - b);
  const isGroove = (z: number) => grooves.some(([a, b]) => z > a && z < b);

  const dg = p.rillenTiefe * ppm;
  const holeCx = capXpx, holeCy = capYpx;
  const slotCy = slotBottom / 2, slotHh = slotBottom / 2 + 1;

  const buildField = (k: { g: boolean; pocket: boolean; cav: boolean; slotHw: number; back: string }) => {
    const f = new Float32Array(N);
    const rIn = (CAP.rLug * kc + p.spiel) * ppm, rOut = (CAP.r * kc + p.spiel) * ppm;
    const nl = rIn, nw = ((CAP.lugW + 2 * p.spiel) / 2) * ppm;
    const coneIdx = k.back.startsWith("cone") ? Number(k.back.slice(4)) : -1;
    const rCone = coneIdx >= 0 ? ((CAP.r + (CAP.rFl - CAP.r) * ((coneIdx + 0.5) / NCONE)) * kc + p.spiel) * ppm : 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const so = sd[i] - Rpx;
        let v = k.g ? so + dg : so;
        if (k.cav) v = Math.max(v, -(so + wallPx));
        if (k.pocket) v = Math.max(v, -(sd[i] - clrPx));
        if (k.slotHw > 0 && slotBottom >= 0) {
          const bx = Math.max(Math.abs(x - slotCx) - k.slotHw * ppm, Math.abs(y - slotCy) - slotHh);
          v = Math.max(v, -bx);
        }
        if (k.back) {
          const dx = x - holeCx, dy = y - holeCy;
          const circ = Math.hypot(dx, dy) - (k.back === "groove" ? rIn : coneIdx >= 0 ? rCone : rOut);
          let hole = circ;
          if (k.back === "neck") hole = Math.min(circ, Math.max(Math.abs(dx) - nl, Math.abs(dy) - nw));
          v = Math.max(v, -hole);
        }
        f[i] = v;
      }
    }
    return f;
  };

  const cache = new Map<string, THREE.Shape[]>();
  const geoCache = new Map<string, THREE.BufferGeometry>();
  const layers: THREE.BufferGeometry[] = [];
  for (let s = 0; s < zlist.length - 1; s++) {
    const a = zlist[s], b = zlist[s + 1];
    if (b - a < 1e-6) continue;
    const zm = (a + b) / 2;
    const k = {
      g: isGroove(zm),
      pocket: zm < P,
      cav: zm > F && zm < D - Bk,
      slotHw: zm > zs && zm < zs + Ls ? (() => { const d = Math.min(zm - zs, zs + Ls - zm); return d >= SLR ? SLR : Math.max(0.15, Math.sqrt(SLR * SLR - (SLR - d) * (SLR - d))); })() : 0,
      back: zm > D - Bk ? (zm < D - Bk + GRT ? "groove" : zm < D - CONEH ? "neck" : `cone${Math.min(NCONE - 1, Math.floor(((zm - (D - CONEH)) / CONEH) * NCONE))}`) : "",
    };
    const key = `${+k.g}${+k.pocket}${+k.cav}${k.slotHw.toFixed(2)}${k.back}`;
    let shapes = cache.get(key);
    if (!shapes) {
      shapes = toShapes(contours(buildField(k), W, H), toMm, epsPx);
      cache.set(key, shapes);
    }
    const gk = `${key}_${(b - a).toFixed(4)}`;
    let g = geoCache.get(gk);
    if (!g) {
      g = new THREE.ExtrudeGeometry(shapes, { depth: b - a, bevelEnabled: false, curveSegments: 1 });
      geoCache.set(gk, g);
    }
    const inst = g.clone();
    inst.translate(0, 0, a);
    layers.push(inst);
  }
  const body = mergeGeometries(layers, false)!;
  geoCache.forEach((g) => g.dispose());
  layers.forEach((g) => g.dispose());

  // Buchstaben (Einleger)
  const letterShapes = toShapes(contours(tf, W, H), toMm, epsPx);
  const letters = new THREE.ExtrudeGeometry(letterShapes, { depth: P + p.ueberstand - 0.0, bevelEnabled: false, curveSegments: 1 });
  letters.translate(0, 0, -p.ueberstand);

  // Kappe (lokal: Unterseite bei z = 0, Oberseite bündig bei z = 7,5):
  // Hals Ø30, Konus-Bund bis Ø36, Griffmulde mit Steg quer zu den Nasen, zwei Nasen 1,5 x 2,4 mm.
  const parts: THREE.BufferGeometry[] = [];
  const ni = (g: THREE.BufferGeometry) => { const n = g.index ? g.toNonIndexed() : g; if (n !== g) g.dispose(); return n; };
  const outward = (g: THREE.BufferGeometry) => {
    const pos = g.getAttribute("position") as THREE.BufferAttribute;
    let vol = 0;
    for (let i = 0; i < pos.count; i += 3) {
      const ax = pos.getX(i), ay = pos.getY(i), az = pos.getZ(i);
      const bx = pos.getX(i + 1), by = pos.getY(i + 1), bz = pos.getZ(i + 1);
      const cx2 = pos.getX(i + 2), cy2 = pos.getY(i + 2), cz2 = pos.getZ(i + 2);
      vol += (ax * (by * cz2 - bz * cy2) - ay * (bx * cz2 - bz * cx2) + az * (bx * cy2 - by * cx2)) / 6;
    }
    if (vol < 0) {
      for (let i = 0; i < pos.count; i += 3) {
        const x = pos.getX(i + 1), y = pos.getY(i + 1), z = pos.getZ(i + 1);
        pos.setXYZ(i + 1, pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2));
        pos.setXYZ(i + 2, x, y, z);
      }
      g.computeVertexNormals();
    }
    return g;
  };
  const k = kc;
  const prof = [
    [0, 0], [CAP.r * k, 0], [CAP.r * k, CAP.neckTop], [CAP.rFl * k, CAP.h],
    [CAP.r * k, CAP.h], [CAP.rRec * k, CAP.floor], [0, CAP.floor],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const lathe = new THREE.LatheGeometry(prof, 96);
  lathe.rotateX(Math.PI / 2);
  parts.push(outward(ni(lathe)));
  // Steg (3 mm, oben 4 mm breit), bündig mit dem Bund
  const webL = 2 * (CAP.r * k + 0.3);
  const web = new THREE.Shape([
    new THREE.Vector2(-1.5, CAP.floor - 0.1), new THREE.Vector2(1.5, CAP.floor - 0.1), new THREE.Vector2(1.5, 6.0),
    new THREE.Vector2(2.0, CAP.h), new THREE.Vector2(-2.0, CAP.h), new THREE.Vector2(-1.5, 6.0),
  ]);
  const webG = new THREE.ExtrudeGeometry(web, { depth: webL, bevelEnabled: false });
  webG.translate(0, 0, -webL / 2);
  webG.rotateX(Math.PI / 2);
  parts.push(outward(webG));
  // Nasen (Bajonett)
  const lug = new THREE.BoxGeometry(2 * CAP.rLug * k, CAP.lugW, CAP.lugH);
  lug.translate(0, 0, CAP.lugH / 2);
  parts.push(ni(lug));
  const cap = mergeGeometries(parts, false)!;
  parts.forEach((g) => g.dispose());
  const capC = toMm([capXpx, capYpx]);

  body.computeBoundingBox();
  const bb = body.boundingBox!;
  return {
    name,
    body, letters, cap,
    capPose: { x: capC.x, y: capC.y, z: D - CAP.h },
    dims: { x: bb.max.x - bb.min.x, y: bb.max.y - bb.min.y, z: D },
    warnings,
    info: { sizeUsed: size, capR: CAP.r * kc, kammern, ppm, randUsed: p.rand },
    valid: nLab > 0 && kammern === 1 && slotBottom >= 0 && colsNoCavity === 0 && kapOk,
  };
}
