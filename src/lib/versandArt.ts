// Automatische Wahl der Versandart im Kalkulator: Briefpost, Grossbrief oder Paket (PostPac Priority nach Gewicht).
// Preise und Grenzen entsprechen den Auswahlmöglichkeiten im Auftrag (Admin → Auftrag → Versandart).

export type Mass3 = [number, number, number];

export const BRIEFPOST = { id: "briefpost", label: "Briefpost A-Post", preis: 2.0, maxG: 100, maxMm: [235, 120, 20] as Mass3, packG: 10 };
export const GROSSBRIEF = { id: "grossbrief", label: "A-Post Grossbrief", preis: 4.0, maxG: 500, maxMm: [353, 250, 20] as Mass3, packG: 30 };

export interface VersandWahl { id: "briefpost" | "grossbrief" | "paket"; label: string; preis: number }

/** Abmessungen (mm) aus einer STL-Datei (binär oder ASCII); null bei Problemen. */
export function dimsFromStl(buffer: ArrayBuffer): Mass3 | null {
  try {
    const view = new DataView(buffer);
    const mn = [Infinity, Infinity, Infinity];
    const mx = [-Infinity, -Infinity, -Infinity];
    const add = (x: number, y: number, z: number) => {
      if (!Number.isFinite(x + y + z)) return;
      if (x < mn[0]) mn[0] = x; if (x > mx[0]) mx[0] = x;
      if (y < mn[1]) mn[1] = y; if (y > mx[1]) mx[1] = y;
      if (z < mn[2]) mn[2] = z; if (z > mx[2]) mx[2] = z;
    };
    const n = view.byteLength >= 84 ? view.getUint32(80, true) : 0;
    if (view.byteLength >= 84 && 84 + n * 50 === view.byteLength) {
      let o = 84;
      for (let i = 0; i < n; i++) {
        o += 12;
        for (let v = 0; v < 3; v++) { add(view.getFloat32(o, true), view.getFloat32(o + 4, true), view.getFloat32(o + 8, true)); o += 12; }
        o += 2;
      }
    } else {
      const text = new TextDecoder().decode(buffer);
      const re = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) add(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]));
    }
    const d: Mass3 = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]];
    return d.every((v) => Number.isFinite(v) && v >= 0) ? d : null;
  } catch { return null; }
}

/** Abmessungen (mm) aus einer OBJ-Datei; null bei Problemen. */
export function dimsFromObj(text: string): Mass3 | null {
  const mn = [Infinity, Infinity, Infinity];
  const mx = [-Infinity, -Infinity, -Infinity];
  for (const line of text.split("\n")) {
    if (line.charCodeAt(0) !== 118 || line.charCodeAt(1) !== 32) continue; // "v "
    const p = line.trim().split(/\s+/);
    for (let i = 0; i < 3; i++) {
      const v = parseFloat(p[i + 1]);
      if (!Number.isFinite(v)) return null;
      if (v < mn[i]) mn[i] = v;
      if (v > mx[i]) mx[i] = v;
    }
  }
  const d: Mass3 = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]];
  return d.every((v) => Number.isFinite(v) && v >= 0) ? d : null;
}

/** Passen alle Teile flach gestapelt in einen Umschlag mit den Höchstmassen? (Dicke = Summe der kleinsten Seiten) */
function passtInBrief(stuecke: { dims: Mass3 | null; qty: number }[], max: Mass3): boolean {
  let dicke = 0;
  for (const s of stuecke) {
    if (!s.dims) return false; // Abmessungen unbekannt: sicherheitshalber kein Brief
    const [d1, d2, d3] = [...s.dims].sort((a, b) => a - b); // d1 dünnste, d3 längste Seite
    if (d3 > max[0] || d2 > max[1]) return false;
    dicke += d1 * Math.max(1, s.qty);
  }
  return dicke <= max[2];
}

/** Wählt die günstigste passende Versandart: Briefpost -> Grossbrief -> Paket. Gewichte in Gramm (Teile ohne Verpackung). */
export function waehleVersandart(
  gramm: number,
  stuecke: { dims: Mass3 | null; qty: number }[],
  paketPreis: (g: number) => number,
): VersandWahl {
  if (stuecke.length > 0) {
    if (gramm + BRIEFPOST.packG <= BRIEFPOST.maxG && passtInBrief(stuecke, BRIEFPOST.maxMm)) {
      return { id: "briefpost", label: BRIEFPOST.label, preis: BRIEFPOST.preis };
    }
    if (gramm + GROSSBRIEF.packG <= GROSSBRIEF.maxG && passtInBrief(stuecke, GROSSBRIEF.maxMm)) {
      return { id: "grossbrief", label: GROSSBRIEF.label, preis: GROSSBRIEF.preis };
    }
  }
  return { id: "paket", label: "Paket (PostPac Priority)", preis: paketPreis(gramm) };
}
