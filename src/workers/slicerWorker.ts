/// <reference lib="webworker" />
// Web Worker: slicet ein binäres STL mit three-slicer (OrcaSlicer-Kernel als WASM)
import { createSlicer } from "three-slicer";

let slicer: any = null;

const initSlicer = async () => {
  if (!slicer) slicer = await createSlicer();
  return slicer;
};

/** Filamentlänge (mm) -> Gramm, Dichte in g/cm³ */
const gramsFromFilamentMm = (mm: number, diameter: number, density: number) => {
  const radiusCm = diameter / 2 / 10;
  const lengthCm = mm / 10;
  const volumeCm3 = Math.PI * radiusCm * radiusCm * lengthCm;
  return volumeCm3 * density;
};


type V3 = [number, number, number];
/** Drehungen (det +1), die die gewählte Seite nach unten (-Z) legen */
const DOWN_ROTATIONS: { name: string; f: (v: V3) => V3 }[] = [
  { name: "Original", f: ([x, y, z]) => [x, y, z] },
  { name: "Auf den Kopf", f: ([x, y, z]) => [x, -y, -z] },
  { name: "Auf die linke Seite", f: ([x, y, z]) => [-z, y, x] },
  { name: "Auf die rechte Seite", f: ([x, y, z]) => [z, y, -x] },
  { name: "Auf die Vorderseite", f: ([x, y, z]) => [x, -z, y] },
  { name: "Auf die Rückseite", f: ([x, y, z]) => [x, z, -y] },
];

/**
 * Wählt die Ausrichtung mit der kleinsten Überhangfläche (Flächen steiler als 45° nach unten,
 * ohne die Auflagefläche) und dreht das binäre STL entsprechend. ASCII-STL bleibt unverändert.
 */
const autoOrient = (bytes: Uint8Array): { bytes: Uint8Array; name: string; before: number; after: number } => {
  const keep = { bytes, name: "Original", before: 0, after: 0 };
  if (bytes.byteLength < 84) return keep;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const n = view.getUint32(80, true);
  if (84 + n * 50 !== bytes.byteLength || n === 0) return keep; // kein binäres STL

  const tri = new Float32Array(n * 9);
  for (let i = 0; i < n; i++) {
    let o = 84 + i * 50 + 12;
    for (let k = 0; k < 9; k++, o += 4) tri[i * 9 + k] = view.getFloat32(o, true);
  }

  const score = (f: (v: V3) => V3) => {
    let minZ = Infinity, maxZ = -Infinity;
    const zs = new Float32Array(n * 3);
    const nz = new Float32Array(n);
    const area = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = f([tri[i * 9], tri[i * 9 + 1], tri[i * 9 + 2]]);
      const b = f([tri[i * 9 + 3], tri[i * 9 + 4], tri[i * 9 + 5]]);
      const c = f([tri[i * 9 + 6], tri[i * 9 + 7], tri[i * 9 + 8]]);
      zs[i * 3] = a[2]; zs[i * 3 + 1] = b[2]; zs[i * 3 + 2] = c[2];
      minZ = Math.min(minZ, a[2], b[2], c[2]);
      maxZ = Math.max(maxZ, a[2], b[2], c[2]);
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
      const len = Math.sqrt(cx * cx + cy * cy + cz * cz);
      area[i] = len / 2;
      nz[i] = len > 0 ? cz / len : 0;
    }
    let overhang = 0;
    for (let i = 0; i < n; i++) {
      if (nz[i] >= -0.7071) continue; // flacher als 45° Überhang -> ohne Support druckbar
      const zmax = Math.max(zs[i * 3], zs[i * 3 + 1], zs[i * 3 + 2]);
      if (zmax - minZ < 0.2) continue; // liegt auf der Platte
      overhang += area[i];
    }
    return { overhang, height: maxZ - minZ };
  };

  const results = DOWN_ROTATIONS.map((r) => ({ r, ...score(r.f) }));
  const orig = results[0];
  // Höhe leicht bestrafen (höher = länger), Überhang stark
  const cost = (x: { overhang: number; height: number }) => x.overhang + x.height * 2;
  let best = orig;
  for (const x of results) if (cost(x) < cost(best)) best = x;
  // Nur drehen, wenn der Überhang deutlich sinkt
  if (best === orig || orig.overhang <= 0 || best.overhang > orig.overhang * 0.7) {
    return { ...keep, before: Math.round(orig.overhang), after: Math.round(orig.overhang) };
  }

  const out = new Uint8Array(bytes.byteLength);
  out.set(bytes.subarray(0, 84));
  const ov = new DataView(out.buffer);
  let minZ = Infinity;
  const rot: V3[] = [];
  for (let i = 0; i < n * 3; i++) {
    const v = best.r.f([tri[i * 3], tri[i * 3 + 1], tri[i * 3 + 2]]);
    rot.push(v);
    if (v[2] < minZ) minZ = v[2];
  }
  for (let i = 0; i < n; i++) {
    const o = 84 + i * 50;
    const nrm = best.r.f([view.getFloat32(o, true), view.getFloat32(o + 4, true), view.getFloat32(o + 8, true)]);
    ov.setFloat32(o, nrm[0], true); ov.setFloat32(o + 4, nrm[1], true); ov.setFloat32(o + 8, nrm[2], true);
    for (let k = 0; k < 3; k++) {
      const v = rot[i * 3 + k];
      ov.setFloat32(o + 12 + k * 12, v[0], true);
      ov.setFloat32(o + 16 + k * 12, v[1], true);
      ov.setFloat32(o + 20 + k * 12, v[2] - minZ, true);
    }
    ov.setUint16(o + 48, 0, true);
  }
  return { bytes: out, name: best.r.name, before: Math.round(orig.overhang), after: Math.round(best.overhang) };
};

self.onmessage = async (e: MessageEvent) => {
  const { id, stlBytes, params, density, autoOrient: doOrient } = e.data;

  try {
    const s = await initSlicer();

    // WICHTIG: Kein onLayer Callback – verhindert Streaming-Modus ohne Zeitschätzung
    let input = new Uint8Array(stlBytes);
    let orientation = { name: "Original", before: 0, after: 0 };
    if (doOrient) {
      try {
        const o = autoOrient(input);
        input = o.bytes;
        orientation = { name: o.name, before: o.before, after: o.after };
      } catch (err) {
        console.warn("Auto-Ausrichtung übersprungen", err);
      }
    }
    const result = s.slice(input, params);

    const stats: Record<string, any> = result?.stats ?? {};
    if (result?.error) throw new Error(String(result.error));

    // time_estimate ist in Sekunden (SliceStats). Fallback: layer_times summieren.
    const timeSec = Number(stats.time_estimate) || 0;
    const layerTimes = stats.layer_times;
    const layerSec = Array.isArray(layerTimes)
      ? (layerTimes as number[]).reduce((a, b) => a + (Number(b) || 0), 0)
      : layerTimes && typeof layerTimes === "object"
        ? Object.values(layerTimes as Record<string, number>).reduce(
            (a: number, b) => a + (Number(b) || 0),
            0,
          )
        : 0;

    const effectiveSec = timeSec > 0 ? timeSec : layerSec;
    const printTimeMinutes = effectiveSec > 0 ? Math.max(1, Math.round(effectiveSec / 60)) : 0;

    const filamentMm = Number(stats.filament_mm) || 0;
    const usedDensity = Number(density) || 1.24;
    // Gramm bevorzugt aus der Filamentlänge rechnen: so stimmt die Dichte des gewählten Materials,
    // und das Ergebnis lässt sich bei Materialwechsel ohne neuen Slice umrechnen.
    const filamentGrams =
      filamentMm > 0
        ? Math.round(
            gramsFromFilamentMm(filamentMm, Number(params?.filament_diameter) || 1.75, usedDensity) * 10,
          ) / 10
        : Number(stats.filament_weight) || Number(stats.filament_g) || 0;

    const layers = Number(stats.layers) || 0;
    // Support nur melden, wenn tatsächlich Support-Extrusionen im G-Code sind
    // (Rollen 7/8 = support / support interface im OrcaSlicer-Kernel)
    const roleTimes = (stats.role_times ?? {}) as Record<string, number>;
    const supportRoleTime = ["7", "8", "10", "11"].reduce(
      (a, k) => a + (Number(roleTimes[k]) || 0),
      0,
    );
    const hasSupport = supportRoleTime > 0;

    self.postMessage({
      id,
      ok: true,
      printTimeMinutes,
      filamentGrams,
      filamentMm,
      density: filamentMm > 0 ? usedDensity : undefined,
      layers,
      hasSupport,
      orientation,
      rawStats: stats,
    });
  } catch (err: any) {
    self.postMessage({ id, ok: false, error: String(err?.message ?? err) });
  }
};
