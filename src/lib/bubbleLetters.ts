// Bubble-Letter-Generator: setzt Text aus den vorgegebenen 3D-Buchstaben (Ceramic Alphabet, A-Z) zusammen.
// Die Buchstaben liegen kompakt in public/fonts/ceramic-alphabet.bin (verschweisste Netze, 16-Bit-quantisiert, 7 MB).
// Jeder Buchstabe: x zentriert, Unterkante y=0, flache Rückseite z=0.

export type BubbleParams = {
  text: string;
  /** Buchstabenhöhe in mm (alle Buchstaben gleich hoch) */
  size: number;
  /** Abstand zwischen den Buchstaben in mm (negativ = überlappen) */
  spacing: number;
  /** Zusätzlicher Zeilenabstand in mm */
  lineGap: number;
};

export const DEFAULTS: BubbleParams = { text: "NORA", size: 40, spacing: 2, lineGap: 4 };

export const LIMITS = {
  size: [10, 200],
  spacing: [-10, 30],
  lineGap: [-10, 40],
} as const;

export const MAX_LINES = 4;
export const MAX_PER_LINE = 20;
export const GLYPH_URL = "/fonts/ceramic-alphabet.bin";
/** Mittlere Buchstabenhöhe der Originaldateien in mm (Referenz für "Buchstabenhöhe") */
export const REF_HEIGHT = 80;
/** Einheitliche Dicke im Verhältnis zur Höhe (Mittelwert der Originale) */
export const REF_DEPTH = 0.245;

/** Druckbetten (Breite × Tiefe in mm) für die Passt-Prüfung */
export const DRUCKER = [
  { id: "K1C", x: 220, y: 220 },
  { id: "K1", x: 220, y: 220 },
  { id: "A1", x: 256, y: 256 },
  { id: "H2C", x: 330, y: 320 },
] as const;

export function clampParams(p: BubbleParams): BubbleParams {
  const c = (v: number, [a, b]: readonly [number, number]) => Math.min(b, Math.max(a, Number.isFinite(v) ? v : a));
  return { ...p, size: c(p.size, LIMITS.size), spacing: c(p.spacing, LIMITS.spacing), lineGap: c(p.lineGap, LIMITS.lineGap) };
}

/** Text bereinigen: bis zu 4 Zeilen à 20 Zeichen, Steuerzeichen raus */
export function sanitizeText(s: string) {
  return s
    .replace(/\r/g, "")
    .split("\n")
    .slice(0, MAX_LINES)
    .map((l) => l.replace(/[\u0000-\u001f]/g, "").slice(0, MAX_PER_LINE))
    .join("\n");
}

const UMLAUT: Record<string, string> = { Ä: "A", Ö: "O", Ü: "U", É: "E", È: "E", Ê: "E", À: "A", Â: "A", Ç: "C", Î: "I", Ô: "O", Û: "U" };

/** Zeichen -> Buchstabe A-Z, Leerraum oder null (nicht vorhanden) */
export function mapChar(ch: string): string | null {
  if (ch === " ") return " ";
  if (ch === "ß") return "S";
  const u = ch.toLocaleUpperCase("de-CH");
  if (/^[A-Z]$/.test(u)) return u;
  return UMLAUT[u] ?? null;
}

export type Glyph = { ch: string; positions: Float32Array; index: Uint32Array; w: number; h: number; d: number };

/** Liest die gepackte Buchstaben-Datei */
export function parseGlyphs(buf: ArrayBuffer): Map<string, Glyph> {
  const dv = new DataView(buf);
  const hl = dv.getUint32(0, true);
  const hdr = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl))) as Record<string, { nv: number; nt: number; off: number; min: number[]; sc: number; w: number; h: number; d: number }>;
  const base = 4 + hl;
  const out = new Map<string, Glyph>();
  for (const [ch, g] of Object.entries(hdr)) {
    // Kopie auf ausgerichtete Puffer (Uint16Array braucht gerade Offsets)
    const q = new Uint16Array(buf.slice(base + g.off, base + g.off + g.nv * 6));
    const ix16 = new Uint16Array(buf.slice(base + g.off + g.nv * 6, base + g.off + g.nv * 6 + g.nt * 6));
    const positions = new Float32Array(g.nv * 3);
    for (let i = 0; i < g.nv; i++) for (let k = 0; k < 3; k++) positions[i * 3 + k] = g.min[k] + q[i * 3 + k] * g.sc;
    const index = new Uint32Array(g.nt * 3);
    for (let i = 0; i < index.length; i++) index[i] = ix16[i];
    out.set(ch, { ch, positions, index, w: g.w, h: g.h, d: g.d });
  }
  return out;
}

export type BubblePart = { index: Uint32Array; ch: string };
export type BubbleResult = {
  positions: Float32Array;
  parts: BubblePart[];
  dims: { x: number; y: number; z: number };
  volume: number;
  triangles: number;
  warnings: string[];
  text: string;
};

/** Setzt Buchstaben zu einem Text zusammen (Massstab, Abstand, Zeilen) */
export function layoutText(glyphs: Map<string, Glyph>, input: BubbleParams): BubbleResult | null {
  const p = clampParams(input);
  const s = p.size / REF_HEIGHT;
  const lines = sanitizeText(p.text).split("\n");
  const warnings: string[] = [];
  const fehlend = new Set<string>();
  const umgewandelt = new Set<string>();
  const space = 0.4 * REF_HEIGHT * s;

  type Place = { g: Glyph; x: number; line: number; k: number; kz: number };
  const places: Place[] = [];
  const lineW: number[] = [];
  lines.forEach((line, li) => {
    let x = 0, first = true;
    for (const ch of line) {
      const m = mapChar(ch);
      if (m === null) { fehlend.add(ch); continue; }
      if (m === " ") { x += space; continue; }
      if (m !== ch.toLocaleUpperCase("de-CH")) umgewandelt.add(`${ch}→${m}`);
      const g = glyphs.get(m);
      if (!g) { fehlend.add(ch); continue; }
      if (!first) x += p.spacing;
      first = false;
      const k = (s * REF_HEIGHT) / g.h; // jeder Buchstabe wird auf dieselbe Höhe gebracht (Proportionen bleiben)
      const kz = (s * REF_HEIGHT * REF_DEPTH) / g.d; // alle Buchstaben gleich dick
      places.push({ g, x: x + (g.w * k) / 2, line: li, k, kz });
      x += g.w * k;
    }
    lineW.push(x);
  });
  if (!places.length) return null;
  if (fehlend.size) warnings.push(`Nicht in den Vorlagen enthalten und weggelassen: ${[...fehlend].map((c) => `"${c}"`).join(" ")} (es gibt nur die Buchstaben A–Z).`);
  if (umgewandelt.size) warnings.push(`Umgewandelt: ${[...umgewandelt].join(", ")} (Umlautpunkte und Akzente gibt es nicht).`);

  const maxW = Math.max(...lineW);
  const lineH = REF_HEIGHT * s + p.lineGap;
  const nLines = lines.length;
  const total = places.reduce((n, pl) => n + pl.g.positions.length / 3, 0);
  const positions = new Float32Array(total * 3);
  const parts: BubblePart[] = [];
  let vo = 0;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, maxZ = 0, tris = 0, volume = 0;
  for (const pl of places) {
    const g = pl.g;
    const ox = pl.x + (maxW - lineW[pl.line]) / 2 - maxW / 2; // jede Zeile mittig
    const oy = (nLines - 1 - pl.line) * lineH - ((nLines - 1) * lineH + REF_HEIGHT * s) / 2;
    const n = g.positions.length / 3;
    for (let i = 0; i < n; i++) {
      const X = ox + g.positions[i * 3] * pl.k, Y = oy + g.positions[i * 3 + 1] * pl.k, Z = g.positions[i * 3 + 2] * pl.kz;
      positions[(vo + i) * 3] = X; positions[(vo + i) * 3 + 1] = Y; positions[(vo + i) * 3 + 2] = Z;
      if (X < minX) minX = X;
      if (X > maxX) maxX = X;
      if (Y < minY) minY = Y;
      if (Y > maxY) maxY = Y;
      if (Z > maxZ) maxZ = Z;
    }
    const index = new Uint32Array(g.index.length);
    for (let i = 0; i < index.length; i++) index[i] = g.index[i] + vo;
    for (let t = 0; t < index.length; t += 3) {
      const a = index[t] * 3, b = index[t + 1] * 3, c = index[t + 2] * 3;
      volume += (positions[a] * (positions[b + 1] * positions[c + 2] - positions[b + 2] * positions[c + 1])
        - positions[a + 1] * (positions[b] * positions[c + 2] - positions[b + 2] * positions[c])
        + positions[a + 2] * (positions[b] * positions[c + 1] - positions[b + 1] * positions[c])) / 6;
    }
    tris += index.length / 3;
    parts.push({ index, ch: g.ch });
    vo += n;
  }
  return { positions, parts, dims: { x: maxX - minX, y: maxY - minY, z: maxZ }, volume: Math.abs(volume), triangles: tris, warnings, text: lines.join("\n") };
}

let glyphPromise: Promise<Map<string, Glyph>> | null = null;
export function loadGlyphs(): Promise<Map<string, Glyph>> {
  if (!glyphPromise) {
    glyphPromise = fetch(GLYPH_URL)
      .then((r) => { if (!r.ok) throw new Error(`Buchstaben konnten nicht geladen werden (${r.status})`); return r.arrayBuffer(); })
      .then(parseGlyphs)
      .catch((e) => { glyphPromise = null; throw e; });
  }
  return glyphPromise;
}

export async function generateBubble(p: BubbleParams): Promise<BubbleResult | null> {
  return layoutText(await loadGlyphs(), p);
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
      for (const q of [a, b, c]) {
        dv.setFloat32(off, positions[q], true); dv.setFloat32(off + 4, positions[q + 1], true); dv.setFloat32(off + 8, positions[q + 2], true);
        off += 12;
      }
      dv.setUint16(off, 0, true);
      off += 2;
    }
  }
  return buf;
}
