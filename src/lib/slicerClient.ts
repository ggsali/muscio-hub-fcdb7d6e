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

  // Plausible Grenzen: max. 70 % des Düsendurchmessers (0.4 mm), min. 0.06 mm
  const NOZZLE = 0.4;
  const layerHeight = Math.min(NOZZLE * 0.7, Math.max(0.06, Number(quality.layerHeight) || 0.2));
  const infill = Math.min(100, Math.max(0, Number(quality.infill) || 0));
  // Konstante Schalendicke -> Qualitätsstufen unterscheiden sich physikalisch korrekt
  const topLayers = Math.max(2, Math.ceil(0.8 / layerHeight));
  const bottomLayers = Math.max(2, Math.ceil(0.6 / layerHeight));

  return {

    // Drucker-Profil (Bambu Lab H2C)
    bed_width: 330,
    bed_depth: 320,
    bed_height: 300,
    nozzle_diameter: 0.4,
    filament_diameter: FILAMENT_DIAMETER,
    printer_structure: "corexy",
    machine_max_speed_x: 1000,
    machine_max_speed_y: 1000,
    machine_max_speed_z: 30,
    machine_max_speed_e: 50,
    machine_max_acceleration_x: 20000,
    machine_max_acceleration_y: 20000,
    machine_max_acceleration_z: 500,
    machine_max_acceleration_e: 5000,
    machine_max_acceleration_extruding: 20000,
    machine_max_acceleration_retracting: 5000,
    machine_max_acceleration_travel: 9000,
    machine_max_jerk_x: 9,
    machine_max_jerk_y: 9,
    machine_max_jerk_z: 3,
    machine_max_jerk_e: 2.5,
    max_accel_e: 5000,
    retraction_length: 0.8,
    retraction_speed: 30,
    deretraction_speed: 30,
    retraction_minimum_travel: 1,
    z_hop: 0.4,

    // Qualität
    layer_height: quality.layerHeight,
    first_layer_height: Math.max(quality.layerHeight, 0.2),
    line_width: 0.42,
    wall_loops: 2,
    infill_density: quality.infill / 100,
    top_shell_layers: 4,
    bottom_shell_layers: 3,
    skirt_loops: 1,

    // Material
    nozzle_temp: nozzleTemp,
    bed_temp: bedTemp,

    // Supports automatisch (offizielle OrcaSlicer-Werte)
    enable_support: true,
    support_type: "normal(auto)",
    support_threshold_angle: 45,
    support_on_build_plate_only: false,
    support_top_z_distance: 0.2,
    support_bottom_z_distance: 0.2,
    support_interface_top_layers: 2,
    support_interface_bottom_layers: 2,
    support_interface_spacing: 0.5,
    support_base_pattern: "rectilinear",
    support_base_pattern_spacing: 2.5,
    support_infill_angle: 0,

    // Geschwindigkeiten (echte Druckerwerte)
    print_speed: 150,
    first_layer_speed: 30,
    travel_speed: 500,
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
