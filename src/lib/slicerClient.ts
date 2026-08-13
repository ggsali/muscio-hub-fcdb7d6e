/* Echter OrcaSlicer-basierter Browser-Slicer (three-slicer) — Client-Wrapper.
 * Slicing läuft in einem Web Worker; Ergebnisse liefern echte Druckzeit,
 * echtes Filamentgewicht, Layer-Anzahl und Support-Erkennung.
 */

export interface SlicerQuality {
  layerHeight: number;
  infill: number; // Prozent
}

export interface SlicerMaterialInput {
  name: string;
  density: number; // g/cm³
}

export interface SlicerResult {
  printTimeSeconds: number;
  filamentGrams: number;
  filamentMm: number;
  hasSupports: boolean;
  layerCount: number;
}

const FILAMENT_DIAMETER = 1.75;

/** PLA / PETG / ABS / ASA / TPU aus dem Materialnamen ableiten */
export function filamentType(name: string): string {
  const n = (name || "").toUpperCase();
  if (n.includes("PETG")) return "PETG";
  if (n.includes("ASA")) return "ASA";
  if (n.includes("ABS")) return "ABS";
  if (n.includes("TPU")) return "TPU";
  return "PLA";
}

export function buildSlicerParams(material: SlicerMaterialInput, quality: SlicerQuality) {
  const type = filamentType(material.name);
  const nozzleTemp = type === "PLA" ? 220 : type === "PETG" ? 240 : 250;
  const bedTemp = type === "PLA" ? 65 : 85;

  return {
    // Bauvolumen Bambu H2C
    bed_width: 330,
    bed_depth: 320,
    bed_height: 325,
    nozzle_diameter: 0.4,
    filament_diameter: FILAMENT_DIAMETER,

    // Qualität (aus QUALITY_PRESETS)
    layer_height: quality.layerHeight,
    first_layer_height: 0.2,
    infill_density: quality.infill / 100,
    wall_loops: 3,
    top_shell_layers: 4,
    bottom_shell_layers: 3,

    // Temperaturen
    nozzle_temperature: nozzleTemp,
    bed_temperature: bedTemp,

    // Support – Slicer entscheidet selbst ob nötig
    enable_support: true,
    support_threshold_angle: 45,

    // Geschwindigkeiten Bambu H2C
    outer_wall_speed: 150,
    inner_wall_speed: 200,
    infill_speed: 300,
    travel_speed: 500,
    initial_layer_speed: 50,

    // Beschleunigung CoreXY
    default_acceleration: 10000,
    travel_acceleration: 10000,
  };
}

/** Filamentlänge (mm) -> Gewicht (g) */
export function filamentMmToGrams(mm: number, density: number): number {
  const radius = FILAMENT_DIAMETER / 2;
  const volumeMm3 = Math.PI * radius * radius * mm;
  const volumeCm3 = volumeMm3 / 1000;
  return volumeCm3 * (density || 1.24);
}

let worker: Worker | null = null;
let seq = 0;
let queue: Promise<unknown> = Promise.resolve();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("../workers/slicer.worker.ts", import.meta.url), { type: "module" });
  }
  return worker;
}

export function slicerSupported(): boolean {
  return typeof Worker !== "undefined" && typeof WebAssembly !== "undefined";
}

/** Slicen (seriell, ein Job nach dem anderen) */
export function sliceFile(
  stl: ArrayBuffer,
  params: object,
  density: number,
  onProgress?: (pct: number) => void,
): Promise<SlicerResult> {
  const run = () =>
    new Promise<SlicerResult>((resolve, reject) => {
      let w: Worker;
      try {
        w = getWorker();
      } catch (e) {
        reject(e);
        return;
      }
      const id = ++seq;
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error("Slicer-Timeout"));
      }, 180_000);

      const onMessage = (e: MessageEvent) => {
        const d = e.data || {};
        if (d.id !== id) return;
        if (d.type === "progress") {
          if (onProgress && d.total > 0) onProgress(Math.min(99, Math.round((d.done / d.total) * 100)));
          return;
        }
        if (d.type === "done") {
          cleanup();
          onProgress?.(100);
          resolve({
            printTimeSeconds: d.printTimeSeconds,
            filamentMm: d.filamentMm,
            filamentGrams: filamentMmToGrams(d.filamentMm, density),
            hasSupports: !!d.hasSupports,
            layerCount: d.layers,
          });
          return;
        }
        if (d.type === "error") {
          cleanup();
          reject(new Error(d.error || "Slicing fehlgeschlagen"));
        }
      };
      const onError = (err: ErrorEvent) => {
        cleanup();
        // Worker ist beschädigt -> neu erstellen beim nächsten Job
        worker?.terminate();
        worker = null;
        reject(new Error(err.message || "Slicer konnte nicht geladen werden"));
      };
      function cleanup() {
        window.clearTimeout(timeout);
        w.removeEventListener("message", onMessage);
        w.removeEventListener("error", onError as EventListener);
      }

      w.addEventListener("message", onMessage);
      w.addEventListener("error", onError as EventListener);
      w.postMessage({ id, stl, params });
    });

  const result = queue.then(run, run);
  queue = result.catch(() => undefined);
  return result;
}
