// 3D-Bubble-Letter-Generator: Text -> aufgeblasene ("Ballon") Buchstaben als druckbares STL.
// Ablauf: Text als Raster zeichnen -> Abstand zum Rand berechnen -> Höhe = rundes Profil über dem Randabstand -> Netz.
// Der Netzbau (buildBubble) arbeitet nur auf einem Raster und ist ohne Browser testbar.

export type BubbleParams = {
  text: string;
  font: string;
  size: number; // Buchstabenhöhe (Grossbuchstaben) in mm
  spacing: number; // zusätzlicher Buchstabenabstand in mm (negativ = überlappend, Buchstaben verschmelzen)
  lineGap: number; // zusätzlicher Zeilenabstand in mm
  fettung: number; // Buchstaben rundum um so viele mm verdicken (chunky Bubble-Look)
  ecken: number; // Ecken der Umrisse um diesen Radius (mm) abrunden
  aufblas: number; // 1 = Halbkreis-Querschnitt (so hoch wie die halbe Strichbreite), kleiner = flacher
  radius: number; // maximale Rundung in mm: breitere Flächen bekommen oben ein flaches Plateau
  weich: number; // Glättung der Oberfläche und des Auslaufs in mm
  beidseitig: boolean; // false = flache Rückseite zum Drucken, true = Ballon von beiden Seiten
};

export const DEFAULTS: BubbleParams = {
  text: "Bubble",
  font: "Baloo 2",
  size: 50,
  spacing: 0,
  lineGap: 4,
  fettung: 1.5,
  ecken: 1.5,
  aufblas: 0.85,
  radius: 14,
  weich: 0.6,
  beidseitig: false,
};

export const LIMITS = {
  size: [10, 150],
  spacing: [-6, 12],
  lineGap: [-10, 30],
  fettung: [0, 6],
  ecken: [0, 5],
  aufblas: [0.3, 1.2],
  radius: [2, 30],
  weich: [0, 2],
} as const;

export const FONTS: { id: string; label: string; css: string }[] = [
  { id: "Baloo 2", label: "Weich (Baloo)", css: '800 {px}px "Baloo 2"' },
  { id: "Lilita One", label: "Kräftig (Lilita)", css: '400 {px}px "Lilita One"' },
  { id: "Chewy", label: "Verspielt (Chewy)", css: '400 {px}px "Chewy"' },
  { id: "Titan One", label: "Dick (Titan One)", css: '400 {px}px "Titan One"' },
  { id: "Fredoka", label: "Rund (Fredoka)", css: '700 {px}px "Fredoka"' },
];

export const FONT_CSS_URL =
  "https://fonts.googleapis.com/css2?family=Baloo+2:wght@800&family=Lilita+One&family=Chewy&family=Titan+One&family=Fredoka:wght@700&display=swap";

/** Druckbetten (Breite × Tiefe in mm) für die Passt-Prüfung */
export const DRUCKER = [
  { id: "K1C", x: 220, y: 220 },
  { id: "K1", x: 220, y: 220 },
  { id: "A1", x: 256, y: 256 },
  { id: "H2C", x: 330, y: 320 },
] as const;

export function clampParams(p: BubbleParams): BubbleParams {
  const c = (v: number, [a, b]: readonly [number, number]) => Math.min(b, Math.max(a, Number.isFinite(v) ? v : a));
  return {
    ...p,
    size: c(p.size, LIMITS.size),
    spacing: c(p.spacing, LIMITS.spacing),
    lineGap: c(p.lineGap, LIMITS.lineGap),
    fettung: c(p.fettung, LIMITS.fettung),
    ecken: c(p.ecken, LIMITS.ecken),
    aufblas: c(p.aufblas, LIMITS.aufblas),
    radius: c(p.radius, LIMITS.radius),
    weich: c(p.weich, LIMITS.weich),
  };
}

export function sanitizeText(s: string) {
  // bis zu 4 Zeilen à 20 Zeichen, Steuerzeichen raus
  return s
    .replace(/\r/g, "")
    .replace(/[^\S\n]+/g, " ")
    .split("\n")
    .slice(0, 4)
    .map((l) => l.slice(0, 20))
    .join("\n");
}

// ---------- Untere Hüllkurve: D(p) = min_q( |p-q|² + f(q) ), exakt und separierbar (Felzenszwalb) ----------
// Mit f = 0 (Seed) bzw. 1e12 ergibt das den quadrierten Abstand zum nächsten Seed,
// mit f = -r² die Vereinigung aller Kugeln (Radius r) = Ballon-Höhenfeld.
function envelope(f: Float64Array, W: number, H: number) {
  const n = Math.max(W, H);
  const col = new Float64Array(n), d = new Float64Array(n), z = new Float64Array(n + 1), v = new Int32Array(n);
  const pass = (len: number, get: (i: number) => number, set: (i: number, val: number) => void) => {
    for (let i = 0; i < len; i++) col[i] = get(i);
    let k = 0;
    v[0] = 0; z[0] = -1e30; z[1] = 1e30;
    for (let q = 1; q < len; q++) {
      let s = (col[q] + q * q - (col[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) {
        k--;
        s = (col[q] + q * q - (col[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      }
      k++;
      v[k] = q; z[k] = s; z[k + 1] = 1e30;
    }
    k = 0;
    for (let q = 0; q < len; q++) {
      while (z[k + 1] < q) k++;
      d[q] = (q - v[k]) * (q - v[k]) + col[v[k]];
    }
    for (let i = 0; i < len; i++) set(i, d[i]);
  };
  for (let x = 0; x < W; x++) pass(H, (j) => f[j * W + x], (j, val) => { f[j * W + x] = val; });
  for (let y = 0; y < H; y++) pass(W, (i) => f[y * W + i], (i, val) => { f[y * W + i] = val; });
}

const SEED = 1e12;

/** Quadrierter Abstand (in Pixel²) jedes Pixels zum nächsten Pixel mit mask[i] === seedValue */
function distSq(seedMask: Uint8Array, W: number, H: number, seedValue: 0 | 1): Float64Array {
  const f = new Float64Array(W * H);
  for (let i = 0; i < f.length; i++) f[i] = seedMask[i] === seedValue ? 0 : SEED;
  envelope(f, W, H);
  return f;
}

// Box-Weichzeichner (Rand = 0), mehrere Runden nähern eine Gauss-Glättung an
function boxBlur(a: Float32Array, W: number, H: number, r: number, rounds = 2) {
  if (r < 1) return;
  const t = new Float32Array(W * H);
  const win = 2 * r + 1;
  for (let it = 0; it < rounds; it++) {
    for (let y = 0; y < H; y++) {
      let s = 0;
      const row = y * W;
      for (let x = -r; x < W + r; x++) {
        const add = x + r, rem = x - r - 1;
        if (add >= 0 && add < W) s += a[row + add];
        if (rem >= 0 && rem < W) s -= a[row + rem];
        if (x >= 0 && x < W) t[row + x] = s / win;
      }
    }
    for (let x = 0; x < W; x++) {
      let s = 0;
      for (let y = -r; y < H + r; y++) {
        const add = y + r, rem = y - r - 1;
        if (add >= 0 && add < H) s += t[add * W + x];
        if (rem >= 0 && rem < H) s -= t[rem * W + x];
        if (y >= 0 && y < H) a[y * W + x] = s / win;
      }
    }
  }
}

/** Buchstaben verdicken und Ecken abrunden: ergibt die saubere, pralle Bubble-Silhouette */
export function praeparierMaske(mask: Uint8Array, W: number, H: number, ppm: number, fettung: number, ecken: number): Uint8Array {
  let m = mask;
  if (fettung > 0) {
    const dsq = distSq(mask, W, H, 1); // Abstand zum nächsten Buchstabenpixel
    const r2 = (fettung * ppm) ** 2;
    m = new Uint8Array(W * H);
    for (let i = 0; i < m.length; i++) m[i] = dsq[i] <= r2 ? 1 : 0;
  }
  const r = Math.round(ecken * ppm);
  if (r >= 1) {
    const a = new Float32Array(W * H);
    for (let i = 0; i < a.length; i++) a[i] = m[i];
    boxBlur(a, W, H, Math.max(1, Math.round(r / 1.5)), 3);
    const out = new Uint8Array(W * H);
    for (let i = 0; i < out.length; i++) out[i] = a[i] >= 0.5 ? 1 : 0;
    return out;
  }
  return m;
}

export type BubblePart = { index: Uint32Array; x0: number; x1: number; y0: number; y1: number };
export type BubbleMesh = {
  positions: Float32Array;
  parts: BubblePart[]; // je zusammenhängendem Teil (Buchstabe) ein Dreiecksindex
  dims: { x: number; y: number; z: number };
  volume: number; // mm³
  triangles: number;
};

/**
 * Netz aus einem Raster (mask: 1 = Buchstabe, Zeile 0 = oben). ppm = Pixel pro mm.
 * Höhe = Vereinigung aller Kugeln, die in die Form passen (Radius = Randabstand, max. `radius`):
 * Jeder Strich bekommt dadurch einen runden Querschnitt wie ein aufgeblasener Schlauch.
 * Am Rand läuft die Höhe auf 0 aus, es gibt keine senkrechten Wände.
 */
export function buildBubble(
  mask: Uint8Array,
  W: number,
  H: number,
  ppm: number,
  o: Pick<BubbleParams, "aufblas" | "radius" | "weich" | "beidseitig">,
): BubbleMesh | null {
  const N = W * H;
  const dsq = distSq(mask, W, H, 0); // Abstand zum nächsten Hintergrundpixel (= zum Rand)
  const Rpx = Math.max(1, o.radius * ppm);
  const g = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    if (!mask[i]) continue;
    const dc = Math.min(Rpx, Math.max(0, Math.sqrt(dsq[i]) - 0.5)); // Abstand zum Rand in Pixel
    g[i] = -dc * dc;
  }
  envelope(g, W, H);
  const h = new Float32Array(N);
  for (let i = 0; i < N; i++) h[i] = (o.aufblas * Math.sqrt(Math.max(0, -g[i]))) / ppm;
  boxBlur(h, W, H, Math.round(o.weich * ppm), 2);
  const EPS = 0.1; // darunter ist die Höhe 0 (Auslauf, kein Absatz)
  for (let i = 0; i < N; i++) h[i] = Math.max(0, h[i] - EPS);

  // Zellen (2×2 Pixel) mit mindestens einem Punkt über 0
  const cw = W - 1, ch = H - 1;
  if (cw < 1 || ch < 1) return null;
  const cell = new Uint8Array(cw * ch);
  const used = new Uint8Array(N);
  let nCells = 0;
  for (let j = 0; j < ch; j++) {
    for (let i = 0; i < cw; i++) {
      const a = j * W + i;
      if (h[a] > 0 || h[a + 1] > 0 || h[a + W] > 0 || h[a + W + 1] > 0) {
        cell[j * cw + i] = 1; nCells++;
        used[a] = used[a + 1] = used[a + W] = used[a + W + 1] = 1;
      }
    }
  }
  if (!nCells) return null;

  // Teile (zusammenhängende Zellen)
  const label = new Int32Array(cw * ch);
  let nLab = 0;
  {
    const q = new Int32Array(cw * ch);
    for (let s0 = 0; s0 < cw * ch; s0++) {
      if (!cell[s0] || label[s0]) continue;
      nLab++;
      let qh = 0, qt = 0;
      q[qt++] = s0; label[s0] = nLab;
      while (qh < qt) {
        const c = q[qh++];
        const x = c % cw;
        if (x > 0 && cell[c - 1] && !label[c - 1]) { label[c - 1] = nLab; q[qt++] = c - 1; }
        if (x < cw - 1 && cell[c + 1] && !label[c + 1]) { label[c + 1] = nLab; q[qt++] = c + 1; }
        if (c >= cw && cell[c - cw] && !label[c - cw]) { label[c - cw] = nLab; q[qt++] = c - cw; }
        if (c < cw * ch - cw && cell[c + cw] && !label[c + cw]) { label[c + cw] = nLab; q[qt++] = c + cw; }
      }
    }
  }

  // Punkte: Oberseite je benutztem Pixel; Unterseite nur, wo die Höhe > 0 ist (sonst ist unten = oben, ohne Wand)
  const mir = o.beidseitig;
  const top = new Int32Array(N).fill(-1);
  const bot = new Int32Array(N).fill(-1);
  let nv = 0;
  for (let i = 0; i < N; i++) {
    if (!used[i]) continue;
    top[i] = nv++;
    bot[i] = h[i] > 0 ? nv++ : top[i];
  }
  const pos = new Float32Array(nv * 3);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, maxZ = 0;
  for (let i = 0; i < N; i++) {
    if (!used[i]) continue;
    const x = (i % W) / ppm, y = (H - 1 - Math.floor(i / W)) / ppm;
    pos[top[i] * 3] = x; pos[top[i] * 3 + 1] = y; pos[top[i] * 3 + 2] = h[i];
    if (bot[i] !== top[i]) { pos[bot[i] * 3] = x; pos[bot[i] * 3 + 1] = y; pos[bot[i] * 3 + 2] = mir ? -h[i] : 0; }
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (h[i] > maxZ) maxZ = h[i];
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  for (let k = 0; k < nv; k++) { pos[k * 3] -= cx; pos[k * 3 + 1] -= cy; }

  const tris: number[][] = Array.from({ length: nLab + 1 }, () => []);
  const bbox = Array.from({ length: nLab + 1 }, () => ({ x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity }));
  for (let j = 0; j < ch; j++) {
    for (let i = 0; i < cw; i++) {
      const cl = label[j * cw + i];
      if (!cl) continue;
      const a = j * W + i, b = a + 1, d = a + W, c = a + W + 1;
      const L = tris[cl];
      const bb = bbox[cl];
      const x0 = pos[top[a] * 3], x1 = pos[top[b] * 3], y0 = pos[top[d] * 3 + 1], y1 = pos[top[a] * 3 + 1];
      if (x0 < bb.x0) bb.x0 = x0; if (x1 > bb.x1) bb.x1 = x1; if (y0 < bb.y0) bb.y0 = y0; if (y1 > bb.y1) bb.y1 = y1;
      // Dreieck (a,c,b): Oberseite gegen den Uhrzeigersinn, Unterseite (a,b,c) umgekehrt. Liegen alle drei Punkte auf Höhe 0,
      // fallen oben und unten zusammen: beide weglassen, die Nachbarn schliessen sich direkt aneinander.
      if (h[a] > 0 || h[c] > 0 || h[b] > 0) {
        L.push(top[a], top[c], top[b]);
        L.push(bot[a], bot[b], bot[c]);
      }
      if (h[a] > 0 || h[d] > 0 || h[c] > 0) {
        L.push(top[a], top[d], top[c]);
        L.push(bot[a], bot[c], bot[d]);
      }
    }
  }

  const parts: BubblePart[] = [];
  let triangles = 0, vol6 = 0;
  for (let l = 1; l <= nLab; l++) {
    if (!tris[l].length) continue;
    const idx = Uint32Array.from(tris[l]);
    parts.push({ index: idx, x0: bbox[l].x0, x1: bbox[l].x1, y0: bbox[l].y0, y1: bbox[l].y1 });
    triangles += idx.length / 3;
    for (let t = 0; t < idx.length; t += 3) {
      const p0 = idx[t] * 3, p1 = idx[t + 1] * 3, p2 = idx[t + 2] * 3;
      vol6 +=
        pos[p0] * (pos[p1 + 1] * pos[p2 + 2] - pos[p1 + 2] * pos[p2 + 1]) -
        pos[p0 + 1] * (pos[p1] * pos[p2 + 2] - pos[p1 + 2] * pos[p2]) +
        pos[p0 + 2] * (pos[p1] * pos[p2 + 1] - pos[p1 + 1] * pos[p2]);
    }
  }
  parts.sort((p, q) => p.x0 - q.x0);
  return {
    positions: pos,
    parts,
    dims: { x: maxX - minX, y: maxY - minY, z: mir ? 2 * maxZ : maxZ },
    volume: Math.abs(vol6 / 6),
    triangles,
  };
}

/** Binäres STL aus Punkten und mehreren Dreiecksindizes */
export function toBinaryStl(positions: Float32Array, indices: Uint32Array[]): ArrayBuffer {
  let n = 0;
  for (const ix of indices) n += ix.length / 3;
  const buf = new ArrayBuffer(84 + n * 50);
  const dv = new DataView(buf);
  const head = "3DMuscio Bubble Letters";
  for (let i = 0; i < head.length; i++) dv.setUint8(i, head.charCodeAt(i));
  dv.setUint32(80, n, true);
  let off = 84;
  for (const ix of indices) {
    for (let t = 0; t < ix.length; t += 3) {
      const a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3;
      const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
      const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
      dv.setFloat32(off, nx, true); dv.setFloat32(off + 4, ny, true); dv.setFloat32(off + 8, nz, true);
      off += 12;
      for (const p of [a, b, c]) {
        dv.setFloat32(off, positions[p], true); dv.setFloat32(off + 4, positions[p + 1], true); dv.setFloat32(off + 8, positions[p + 2], true);
        off += 12;
      }
      dv.setUint16(off, 0, true);
      off += 2;
    }
  }
  return buf;
}

// ---------- Browser: Text -> Raster ----------
let fontsRequested = false;
export async function loadFonts() {
  if (typeof document === "undefined") return;
  if (!fontsRequested) {
    fontsRequested = true;
    if (!document.querySelector("link[data-bubble-fonts]")) {
      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = FONT_CSS_URL;
      l.setAttribute("data-bubble-fonts", "1");
      document.head.appendChild(l);
    }
  }
  try {
    await Promise.all(FONTS.map((f) => document.fonts.load(f.css.replace("{px}", "40"), "AaBb")));
  } catch {
    /* Schrift-Fallback */
  }
}

export type BubbleResult = BubbleMesh & { ppm: number; warnings: string[]; text: string };

export async function generateBubble(input: BubbleParams): Promise<BubbleResult | null> {
  const p = clampParams(input);
  const text = sanitizeText(p.text);
  const lines = text.split("\n").map((l) => l.replace(/\s+$/g, ""));
  if (!lines.some((l) => l.trim())) return null;
  await loadFonts();
  const font = FONTS.find((f) => f.id === p.font) ?? FONTS[0];
  const fontStr = (px: number) => font.css.replace("{px}", String(px));
  const warnings: string[] = [];

  const meas = document.createElement("canvas").getContext("2d")!;
  meas.font = fontStr(200);
  const capRatio = meas.measureText("H").actualBoundingBoxAscent / 200 || 0.7;
  meas.font = fontStr(100);
  const adv = lines.map((l) => [...l].map((c) => meas.measureText(c).width / 100));
  const widthMm = lines.map((_, k) => (adv[k].reduce((a, b) => a + b, 0) * p.size) / capRatio + p.spacing * Math.max(0, adv[k].length - 1));
  const maxW = Math.max(...widthMm, p.size);
  const pitch = p.size * 1.2 + p.lineGap;
  const totalH = pitch * (lines.length - 1) + p.size * 1.5;

  // Rasterauflösung nach Grösse wählen (begrenzt die Dreiecke auf ca. 0,5 Mio.)
  const area = maxW * totalH;
  const ppm = Math.min(5, Math.max(1.5, Math.sqrt(80000 / (0.4 * area))));
  if (ppm < 3) warnings.push(`Grosser Text: Auflösung ${ppm.toFixed(1)} Punkte/mm, Kanten können leicht gestuft sein. Besser in Teilen drucken.`);

  const fontPx = (p.size / capRatio) * ppm;
  meas.font = fontStr(fontPx);
  let asc = 0, desc = 0;
  for (const l of lines) for (const c of l) {
    const m = meas.measureText(c);
    asc = Math.max(asc, m.actualBoundingBoxAscent);
    desc = Math.max(desc, m.actualBoundingBoxDescent);
  }
  const pad = Math.ceil((p.fettung + p.ecken + p.weich + 2) * ppm) + 4;
  const W = Math.ceil(maxW * ppm) + 2 * pad + 8;
  const Hh = Math.ceil(asc + desc + (lines.length - 1) * pitch * ppm) + 2 * pad;
  if (W * Hh > 3_500_000) {
    warnings.push("Text ist zu gross zum Berechnen. Bitte kürzer oder kleiner wählen.");
    return null;
  }
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = Hh;
  const ctx = cv.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#000";
  ctx.font = fontStr(fontPx);
  ctx.textBaseline = "alphabetic";
  lines.forEach((l, k) => {
    let x = pad + 4 + ((maxW - widthMm[k]) / 2) * ppm;
    const y = pad + asc + k * pitch * ppm;
    [...l].forEach((c, i) => {
      ctx.fillText(c, x, y);
      x += adv[k][i] * fontPx + p.spacing * ppm;
    });
  });
  const img = ctx.getImageData(0, 0, W, Hh).data;
  const mask = new Uint8Array(W * Hh);
  for (let i = 0; i < mask.length; i++) mask[i] = img[i * 4 + 3] >= 128 ? 1 : 0;

  const mesh = buildBubble(praeparierMaske(mask, W, Hh, ppm, p.fettung, p.ecken), W, Hh, ppm, p);
  if (!mesh) return null;
  return { ...mesh, ppm, warnings, text };
}
