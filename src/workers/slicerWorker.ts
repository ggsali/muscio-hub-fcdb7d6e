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

self.onmessage = async (e: MessageEvent) => {
  const { id, stlBytes, params, density } = e.data;

  try {
    const s = await initSlicer();

    // WICHTIG: Kein onLayer Callback – verhindert Streaming-Modus ohne Zeitschätzung
    const result = s.slice(new Uint8Array(stlBytes), params);

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
    const filamentGrams =
      Number(stats.filament_weight) ||
      Number(stats.filament_g) ||
      (filamentMm > 0
        ? Math.round(
            gramsFromFilamentMm(
              filamentMm,
              Number(params?.filament_diameter) || 1.75,
              Number(density) || 1.24,
            ) * 10,
          ) / 10
        : 0);

    console.log("RAW", JSON.stringify(stats));
    const layers = Number(stats.layers) || 0;
    const hasSupport = (Number(stats.t_support_ms) || 0) > 100;

    self.postMessage({
      id,
      ok: true,
      printTimeMinutes,
      filamentGrams,
      filamentMm,
      layers,
      hasSupport,
      rawStats: stats,
    });
  } catch (err: any) {
    self.postMessage({ id, ok: false, error: String(err?.message ?? err) });
  }
};
