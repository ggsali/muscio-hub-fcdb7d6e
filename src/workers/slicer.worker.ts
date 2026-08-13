/* eslint-disable @typescript-eslint/no-explicit-any */
// Headless OrcaSlicer-Kernel (three-slicer) im Web Worker — blockiert den Main-Thread nicht.
// Protokoll: { id, stl: ArrayBuffer, params: object } -> progress* / done / error
import { createSlicer } from "three-slicer";

let slicerPromise: Promise<any> | null = null;

self.onmessage = async (e: MessageEvent) => {
  const { id, stl, params } = e.data || {};
  try {
    if (!slicerPromise) slicerPromise = createSlicer();
    const slicer = await slicerPromise;

    let hasSupports = false;

    const result = slicer.slice(new Uint8Array(stl), params, {
      onProgress: (done: number, total: number) =>
        (self as any).postMessage({ id, type: "progress", done, total }),
      onLayer: ({ gcode }: { gcode: string }) => {
        if (!hasSupports && gcode && /;\s*TYPE:\s*Support/i.test(gcode)) hasSupports = true;
      },
    });

    // VOLLSTÄNDIGER DEBUG LOG – damit wir alle Feldnamen sehen
    console.log("[Slicer Worker] Raw result:", JSON.stringify(result));
    console.log("[Slicer Worker] result.stats:", JSON.stringify(result?.stats));
    console.log("[Slicer Worker] Stats keys:", Object.keys(result?.stats || {}));

    if (!result || result.error) throw new Error(result?.error || "Slicing fehlgeschlagen");

    const stats = result.stats || result.metadata || result || {};

    const printTimeSeconds =
      Number(stats.time_estimate) ||
      Number(stats.printTime) ||
      Number(stats.print_time) ||
      Number(stats.estimatedTime) ||
      Number(stats.estimated_time) ||
      Number(stats.time) ||
      Number(result.time_estimate) ||
      Number(result.printTime) ||
      0;

    const filamentMm =
      Number(stats.filament_mm) ||
      Number(stats.filamentLength) ||
      Number(stats.filament_length) ||
      Number(stats.extruded_mm) ||
      Number(result.filament_mm) ||
      0;

    const layers =
      Number(stats.layers) ||
      Number(stats.layer_count) ||
      Number(stats.layerCount) ||
      0;

    console.log("[Slicer Worker] Parsed:", { printTimeSeconds, filamentMm, layers, hasSupports });

    (self as any).postMessage({
      id,
      type: "done",
      hasSupports,
      layers,
      filamentMm,
      printTimeSeconds,
    });
  } catch (err: any) {
    console.error("[Slicer Worker] Error:", err);
    (self as any).postMessage({ id, type: "error", error: String(err?.message || err) });
  }
};
