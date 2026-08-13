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
    // onLayer = Streaming-Modus: jede Schicht wird sofort freigegeben (kein RAM-Peak),
    // gleichzeitig prüfen wir den G-Code-Chunk auf Stützstrukturen.
    const result = slicer.slice(new Uint8Array(stl), params, {
      onProgress: (done: number, total: number) =>
        (self as any).postMessage({ id, type: "progress", done, total }),
      onLayer: ({ gcode }: { gcode: string }) => {
        if (!hasSupports && gcode && /support/i.test(gcode)) hasSupports = true;
      },
    });

    if (!result || result.error) throw new Error(result?.error || "Slicing fehlgeschlagen");
    const stats = result.stats || {};
    (self as any).postMessage({
      id,
      type: "done",
      hasSupports,
      layers: Number(stats.layers) || 0,
      filamentMm: Number(stats.filament_mm) || 0,
      printTimeSeconds: Number(stats.time_estimate) || 0,
    });
  } catch (err: any) {
    (self as any).postMessage({ id, type: "error", error: String(err?.message || err) });
  }
};
