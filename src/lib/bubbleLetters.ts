// 3D-Bubble-Letter-Generator: Text -> aufgeblasene ("Ballon") Buchstaben als druckbares STL.
// Ablauf: Text als Raster zeichnen -> Abstand zum Rand berechnen -> Höhe = rundes Profil über dem Randabstand -> Netz.
// Der Netzbau (buildBubble) arbeitet nur auf einem Raster und ist ohne Browser testbar.

export type BubbleParams = {
  text: string;
  font: string;
  size: number; // Buchstabenhöhe (Grossbuchstaben) in mm
  spacing: number; // zusätzlicher Buchstabenabstand in mm (negativ = überlappend, Buchstaben verschmelzen)
  lineGap: number; // zusätzlicher Zeilenabstand in mm
  hoehe: number; // maximale Höhe der Aufblasung in mm
  radius: number; // Aufblasradius: ab diesem Randabstand ist die volle Höhe erreicht
  fuelle: number; // Profilform: 2 = Kreis, höher = fülliger/kissenartiger, niedriger = spitzer
  weich: number; // Glättung der Grate in mm
  beidseitig: boolean; // false = flache Rückseite zum Drucken, true = Ballon von beiden Seiten
};

export const DEFAULTS: BubbleParams = {
  text: "Bubble",
  font: "Baloo 2",
  size: 50,
  spacing: 0,
  lineGap: 4,
  hoehe: 12,
  radius: 10,
  fuelle: 2.2,
  weich: 1,
  beidseitig: false,
};

export const LIMITS = {
  size: [10, 150],
  spacing: [-6, 12],
  lineGap: [-10, 30],
  hoehe: [2, 40],
  radius: [1, 30],
  fuelle: [1.5, 4],
  weich: [0, 4],
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
    hoehe: c(p.hoehe, LIMITS.hoehe),
    radius: c(p.radius, LIMITS.radius),
    fuelle: c(p.fuelle, LIMITS.fuelle),
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

// ---------- Distanz zum nächsten Hintergrundpixel (exakt, Felzenszwalb) ----------
function edtSquared(inside: Uint8Array, W: number, H: number): Float32Array {
  const SEED = 1e12;
  const g = new Float64Array(W * H);
  for (let i = 0; i < g.length; i++) g[i] = inside[i] ? SEED : 0;
  const n = Math.max(W, H);
  const f = new Float64Array(n), d = new Float64Array(n), z = new Float64Array(n + 1), v = new Int32Array(n);
  const pass = (len: number, get: (i: number) => number, set: (i: number, val: number) => void) => {
    for (let i = 0; i < len; i++) f[i] = get(i);
    let k = 0;
    v[0] = 0; z[0] = -1e30; z[1] = 1e30;
    for (let q = 1; q < len; q++) {
      let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) {
        k--;
        s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      }
      k++;
      v[k] = q; z[k] = s; z[k + 1] = 1e30;
    }
    k = 0;
    for (let q = 0; q < len; q++) {
      while (z[k + 1] < q) k++;
      d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
    }
    for (let i = 0; i < len; i++) set(i, d[i]);
  };
  for (let x = 0; x < W; x++) pass(H, (j) => g[j * W + x], (j, val) => { g[j * W + x] = val; });
  for (let y = 0; y < H; y++) pass(W, (i) => g[y * W + i], (i, val) => { g[y * W + i] = val; });
  const out = new Float32Array(W * H);
  for (let i = 0; i < out.length; i++) out[i] = g[i];
  return out;
}

// Weichzeichnen nur innerhalb der Form (Gewichte = Innenpixel), damit der Rand nicht ausblutet
function blurInside(h: Float32Array, inside: Uint8Array, W: number, H: number, r: number, rounds = 2) {
  if (r < 1) return;
  const num = new Float32Array(W * H), den = new Float32Array(W * H);
  for (let i = 0; i < h.length; i++) { num[i] = inside[i] ? h[i] : 0; den[i] = inside[i] ? 1 : 0; }
  const tn = new Float32Array(W * H), td = new Float32Array(W * H);
  for (let it = 0; it < rounds; it++) {
    for (let y = 0; y < H; y++) {
      let sn = 0, sd = 0;
      const row = y * W;
      for (let x = -r; x < W + r; x++) {
        const add = x + r, rem = x - r - 1;
        if (add < W && add >= 0) { sn += num[row + add]; sd += den[row + add]; }
        if (rem >= 0 && rem < W) { sn -= num[row + rem]; sd -= den[row + rem]; }
        if (x >= 0 && x < W) { tn[row + x] = sn; td[row + x] = sd; }
      }
    }
    for (let x = 0; x < W; x++) {
      let sn = 0, sd = 0;
      for (let y = -r; y < H + r; y++) {
        const add = y + r, rem = y - r - 1;
        if (add < H && add >= 0) { sn += tn[add * W + x]; sd += td[add * W + x]; }
        if (rem >= 0 && rem < H) { sn -= tn[rem * W + x]; sd -= td[rem * W + x]; }
        if (y >= 0 && y < H) { num[y * W + x] = sn; den[y * W + x] = sd; }
      }
    }
    // normieren und für die nächste Runde als Mittelwert weiterverwenden
    for (let i = 0; i < num.length; i++) {
      if (inside[i] && den[i] > 0) { num[i] = num[i] / den[i]; den[i] = 1; } else { num[i] = 0; den[i] = 0; }
    }
  }
  for (let i = 0; i < h.length; i++) if (inside[i]) h[i] = num[i];
}

export type BubblePart = { index: Uint32Array; x0: number; x1: number; y0: number; y1: number };
export type BubbleMesh = {
  positions: Float32Array;
  parts: BubblePart[]; // je zusammenhängendem Teil (Buchstabe) ein Dreiecksindex
  dims: { x: number; y: number; z: number };
  volume: number; // mm³
  triangles: number;
};

/** Netz aus einem Raster (mask: 1 = Buchstabe, Zeile 0 = oben). ppm = Pixel pro mm. */
export function buildBubble(
  mask: Uint8Array,
  W: number,
  H: number,
  ppm: number,
  o: Pick<BubbleParams, "hoehe" | "radius" | "fuelle" | "weich" | "beidseitig">,
): BubbleMesh | null {
  const N = W * H;
  const dt = edtSquared(mask, W, H);
  const R = Math.max(0.5, o.radius);
  const pw = Math.max(1.05, o.fuelle);
  const h = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    if (!mask[i]) continue;
    const dmm = Math.max(0, Math.sqrt(dt[i]) - 0.5) / ppm; // Abstand Pixelmitte -> Rand
    const t = Math.min(1, dmm / R);
    h[i] = o.hoehe * Math.pow(1 - Math.pow(1 - t, pw), 1 / pw);
  }
  blurInside(h, mask, W, H, Math.round(o.weich * ppm));

  // Zusammenhängende Teile (4er-Nachbarschaft)
  const label = new Int32Array(N);
  let nLab = 0;
  {
    const q = new Int32Array(N);
    for (let s = 0; s < N; s++) {
      if (!mask[s] || label[s]) continue;
      nLab++;
      let qh = 0, qt = 0;
      q[qt++] = s; label[s] = nLab;
      while (qh < qt) {
        const c = q[qh++];
        const x = c % W;
        if (x > 0 && mask[c - 1] && !label[c - 1]) { label[c - 1] = nLab; q[qt++] = c - 1; }
        if (x < W - 1 && mask[c + 1] && !label[c + 1]) { label[c + 1] = nLab; q[qt++] = c + 1; }
        if (c >= W && mask[c - W] && !label[c - W]) { label[c - W] = nLab; q[qt++] = c - W; }
        if (c < N - W && mask[c + W] && !label[c + W]) { label[c + W] = nLab; q[qt++] = c + W; }
      }
    }
  }

  // Zellen (2×2 Pixel), die komplett innen liegen
  const cw = W - 1, ch = H - 1;
  if (cw < 1 || ch < 1) return null;
  const cell = new Uint8Array(cw * ch);
  const used = new Uint8Array(N);
  let nCells = 0;
  for (let j = 0; j < ch; j++) {
    for (let i = 0; i < cw; i++) {
      const a = j * W + i;
      if (mask[a] && mask[a + 1] && mask[a + W] && mask[a + W + 1]) {
        cell[j * cw + i] = 1; nCells++;
        used[a] = used[a + 1] = used[a + W] = used[a + W + 1] = 1;
      }
    }
  }
  if (!nCells) return null;

  // Punkte: je benutztem Pixel oben (2k) und unten (2k+1)
  const vid = new Int32Array(N).fill(-1);
  let nv = 0;
  for (let i = 0; i < N; i++) if (used[i]) vid[i] = nv++;
  const pos = new Float32Array(nv * 2 * 3);
  const mir = o.beidseitig;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, maxZ = 0;
  for (let i = 0; i < N; i++) {
    const k = vid[i];
    if (k < 0) continue;
    const x = (i % W) / ppm, y = (H - 1 - Math.floor(i / W)) / ppm;
    pos[k * 6] = x; pos[k * 6 + 1] = y; pos[k * 6 + 2] = h[i];
    pos[k * 6 + 3] = x; pos[k * 6 + 4] = y; pos[k * 6 + 5] = mir ? -h[i] : 0;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (h[i] > maxZ) maxZ = h[i];
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  for (let k = 0; k < nv * 2; k++) { pos[k * 3] -= cx; pos[k * 3 + 1] -= cy; }

  const tris: number[][] = Array.from({ length: nLab + 1 }, () => []);
  const bbox: { x0: number; x1: number; y0: number; y1: number }[] = Array.from({ length: nLab + 1 }, () => ({ x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity }));

  const wall = (L: number[], p: number, q: number, ox: number, oy: number) => {
    const tp = vid[p] * 2, bp = tp + 1, tq = vid[q] * 2, bq = tq + 1;
    // Dreieck (bp, bq, tq): Normale prüfen
    const ax = pos[bq * 3] - pos[bp * 3], ay = pos[bq * 3 + 1] - pos[bp * 3 + 1], az = pos[bq * 3 + 2] - pos[bp * 3 + 2];
    const bx = pos[tq * 3] - pos[bp * 3], by = pos[tq * 3 + 1] - pos[bp * 3 + 1], bz = pos[tq * 3 + 2] - pos[bp * 3 + 2];
    const nx = ay * bz - az * by, ny = az * bx - ax * bz;
    if (nx * ox + ny * oy >= 0) L.push(bp, bq, tq, bp, tq, tp);
    else L.push(bp, tq, bq, bp, tp, tq);
  };

  for (let j = 0; j < ch; j++) {
    for (let i = 0; i < cw; i++) {
      if (!cell[j * cw + i]) continue;
      const a = j * W + i, b = a + 1, d = a + W, c = a + W + 1;
      const L = tris[label[a]];
      const bb = bbox[label[a]];
      const x0 = pos[vid[a] * 6], x1 = pos[vid[b] * 6], y0 = pos[vid[d] * 6 + 1], y1 = pos[vid[a] * 6 + 1];
      if (x0 < bb.x0) bb.x0 = x0; if (x1 > bb.x1) bb.x1 = x1; if (y0 < bb.y0) bb.y0 = y0; if (y1 > bb.y1) bb.y1 = y1;
      const ta = vid[a] * 2, tb = vid[b] * 2, tc = vid[c] * 2, td = vid[d] * 2;
      // oben (von +z gesehen gegen den Uhrzeigersinn), unten umgekehrt
      L.push(ta, tc, tb, ta, td, tc);
      L.push(ta + 1, tb + 1, tc + 1, ta + 1, tc + 1, td + 1);
      if (j === 0 || !cell[(j - 1) * cw + i]) wall(L, a, b, 0, 1);
      if (j === ch - 1 || !cell[(j + 1) * cw + i]) wall(L, d, c, 0, -1);
      if (i === 0 || !cell[j * cw + i - 1]) wall(L, a, d, -1, 0);
      if (i === cw - 1 || !cell[j * cw + i + 1]) wall(L, b, c, 1, 0);
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
  const ppm = Math.min(5, Math.max(1.5, Math.sqrt(110000 / (0.4 * area))));
  if (ppm < 3) warnings.push(`Grosser Text: Auflösung ${ppm.toFixed(1)} Punkte/mm, Kanten können leicht gestuft sein. Besser in Teilen drucken.`);

  const fontPx = (p.size / capRatio) * ppm;
  meas.font = fontStr(fontPx);
  let asc = 0, desc = 0;
  for (const l of lines) for (const c of l) {
    const m = meas.measureText(c);
    asc = Math.max(asc, m.actualBoundingBoxAscent);
    desc = Math.max(desc, m.actualBoundingBoxDescent);
  }
  const pad = 3;
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

  const mesh = buildBubble(mask, W, Hh, ppm, p);
  if (!mesh) return null;
  if (p.radius > p.hoehe * 1.5) warnings.push("Der Aufblasradius ist deutlich grösser als die Höhe: die Buchstaben wirken flach.");
  return { ...mesh, ppm, warnings, text };
}
