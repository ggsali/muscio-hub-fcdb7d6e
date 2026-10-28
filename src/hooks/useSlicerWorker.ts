import { useRef, useCallback, useEffect } from "react";

export interface SlicerResult {
  printTimeMinutes: number;
  filamentGrams: number;
  filamentMm: number;
  /** Dichte (g/cm³), mit der filamentGrams gerechnet wurde – für die Umrechnung bei Materialwechsel */
  density?: number;
  layers: number;
  hasSupport: boolean;
  /** Wurde das Modell wegen seiner Grösse in mehrere Teile geteilt (Server-Slicer)? Anzahl der Teile, sonst leer */
  splitParts?: number;
  /** Mengenrechnung des Server-Slicers: so viele Kopien auf so vielen Platten (Werte dieses Ergebnisses gelten pro Stück) */
  batch?: { copies: number; plates: number; printer?: string };
  /** Gewählte Ausrichtung (Überhangfläche in mm² vorher/nachher) */
  orientation?: { name: string; before: number; after: number };
}

export interface SlicerParams {
  material: string;
  layerHeight: number;
  infill: number;
  speedFactor: number;
  density?: number;
}

/** Maximal so viele Slicer-Worker parallel (jeder lädt den WASM-Kernel, daher begrenzt) */
const MAX_WORKERS = Math.max(1, Math.min(3, (typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 2 : 2) - 1));

interface Job {
  id: string;
  message: any;
  transfer: Transferable[];
  priority: number;
}

export function useSlicerWorker() {
  const poolRef = useRef<{ worker: Worker; busyId: string | null }[]>([]);
  const queueRef = useRef<Job[]>([]);
  const pendingRef = useRef<
    Map<string, { resolve: (r: SlicerResult) => void; reject: (e: Error) => void }>
  >(new Map());

  const dispatch = useCallback(() => {
    const pool = poolRef.current;
    while (queueRef.current.length > 0) {
      let slot = pool.find((w) => w.busyId === null);
      if (!slot && pool.length < MAX_WORKERS) {
        const worker = new Worker(new URL("../workers/slicerWorker.ts", import.meta.url), { type: "module" });
        slot = { worker, busyId: null };
        const s = slot;
        worker.onmessage = (e: MessageEvent) => {
          const { id, ok, error, ...result } = e.data || {};
          s.busyId = null;
          const pending = pendingRef.current.get(id);
          pendingRef.current.delete(id);
          if (pending) {
            if (ok) pending.resolve(result as SlicerResult);
            else pending.reject(new Error(error || "Slicer-Fehler"));
          }
          dispatch();
        };
        worker.onerror = (ev) => {
          const err = new Error(ev.message || "Slicer-Worker abgestürzt");
          if (s.busyId) {
            pendingRef.current.get(s.busyId)?.reject(err);
            pendingRef.current.delete(s.busyId);
          }
          s.busyId = null;
          worker.terminate();
          const i = poolRef.current.indexOf(s);
          if (i >= 0) poolRef.current.splice(i, 1);
          dispatch();
        };
        pool.push(slot);
      }
      if (!slot) return;
      // Höchste Priorität zuerst (Sofortpreis vor genauem Slice), sonst in Reihenfolge
      queueRef.current.sort((x, y) => y.priority - x.priority);
      const job = queueRef.current.shift()!;
      slot.busyId = job.id;
      try {
        slot.worker.postMessage(job.message, job.transfer);
      } catch (e: any) {
        slot.busyId = null;
        pendingRef.current.get(job.id)?.reject(new Error(String(e?.message ?? e)));
        pendingRef.current.delete(job.id);
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      poolRef.current.forEach((w) => w.worker.terminate());
      poolRef.current = [];
      queueRef.current = [];
      pendingRef.current.clear();
    };
  }, []);

  const slice = useCallback(
    (stlArrayBuffer: ArrayBuffer, params: SlicerParams, priority = 0): Promise<SlicerResult> => {
      return new Promise((resolve, reject) => {
        const id = crypto.randomUUID();
        pendingRef.current.set(id, { resolve, reject });

        const mat = params.material.toUpperCase();
        const slicerParams = {
          // Creality K2 Plus Profil (350 × 350 × 350 mm)
          bed_width: 350,
          bed_depth: 350,
          bed_height: 350,
          nozzle_diameter: 0.4,
          filament_diameter: 1.75,

          // Qualität
          layer_height: params.layerHeight,
          first_layer_height: Math.min(0.2, params.layerHeight),
          sparse_infill_density: params.infill / 100,
          wall_loops: 3,
          top_shell_layers: 4,
          bottom_shell_layers: 3,

          // Temperaturen
          nozzle_temperature: mat.includes("PETG")
            ? 240
            : mat.includes("ABS") || mat.includes("ASA")
              ? 250
              : 220,
          bed_temperature: mat.includes("PLA") ? 65 : 85,

          // K2 Plus Geschwindigkeiten (konservativ)
          outer_wall_speed: 120,
          inner_wall_speed: 180,
          sparse_infill_speed: 250,
          internal_solid_infill_speed: 200,
          top_surface_speed: 100,
          travel_speed: 400,
          initial_layer_speed: 50,

          // Beschleunigung CoreXY
          default_acceleration: 8000,
          travel_acceleration: 8000,

          // Support
          enable_support: true,
          support_threshold_angle: 45,
        };

        queueRef.current.push({
          id,
          message: { id, stlBytes: stlArrayBuffer, params: slicerParams, density: params.density ?? 1.24, autoOrient: true },
          transfer: [stlArrayBuffer], // Transfer ownership für Performance
          priority,
        });
        dispatch();
      });
    },
    [dispatch],
  );

  return { slice };
}
