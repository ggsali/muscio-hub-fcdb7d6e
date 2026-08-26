import { useRef, useCallback, useEffect } from "react";

export interface SlicerResult {
  printTimeMinutes: number;
  filamentGrams: number;
  filamentMm: number;
  layers: number;
  hasSupport: boolean;
}

export interface SlicerParams {
  material: string;
  layerHeight: number;
  infill: number;
  speedFactor: number;
  density?: number;
}

export function useSlicerWorker() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<
    Map<string, { resolve: (r: SlicerResult) => void; reject: (e: Error) => void }>
  >(new Map());

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(new URL("../workers/slicerWorker.ts", import.meta.url), {
        type: "module",
      });
      workerRef.current.onmessage = (e: MessageEvent) => {
        const { id, ok, error, ...result } = e.data || {};
        const pending = pendingRef.current.get(id);
        if (!pending) return;
        pendingRef.current.delete(id);
        if (ok) pending.resolve(result as SlicerResult);
        else pending.reject(new Error(error || "Slicer-Fehler"));
      };
      workerRef.current.onerror = (ev) => {
        const err = new Error(ev.message || "Slicer-Worker abgestürzt");
        pendingRef.current.forEach((p) => p.reject(err));
        pendingRef.current.clear();
      };
    }
    return workerRef.current;
  }, []);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      pendingRef.current.clear();
    };
  }, []);

  const slice = useCallback(
    (stlArrayBuffer: ArrayBuffer, params: SlicerParams): Promise<SlicerResult> => {
      return new Promise((resolve, reject) => {
        const id = crypto.randomUUID();
        pendingRef.current.set(id, { resolve, reject });

        const mat = params.material.toUpperCase();
        const slicerParams = {
          // Bambu H2C Profil
          bed_width: 330,
          bed_depth: 320,
          bed_height: 325,
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

          // Bambu H2C Geschwindigkeiten
          outer_wall_speed: 150,
          inner_wall_speed: 200,
          sparse_infill_speed: 300,
          internal_solid_infill_speed: 250,
          top_surface_speed: 100,
          travel_speed: 500,
          initial_layer_speed: 50,

          // Beschleunigung CoreXY
          default_acceleration: 10000,
          travel_acceleration: 10000,

          // Support
          enable_support: true,
          support_threshold_angle: 45,
        };

        try {
          getWorker().postMessage(
            { id, stlBytes: stlArrayBuffer, params: slicerParams, density: params.density ?? 1.24 },
            [stlArrayBuffer], // Transfer ownership für Performance
          );
        } catch (e: any) {
          pendingRef.current.delete(id);
          reject(new Error(String(e?.message ?? e)));
        }
      });
    },
    [getWorker],
  );

  return { slice };
}
