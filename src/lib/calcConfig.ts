import { supabase } from "@/integrations/supabase/client";

export interface QualityPreset {
  key: string;
  label: string;
  infill: number;
  layerHeight: number;
  /** Multiplikator auf die Slicer-Druckzeit (1.0 = kein Eingriff) */
  speedFactor: number;
  desc: string;
}

export interface CalcParams {
  fix_cost: number;
  support_surcharge: number;
  min_price: number;
}

export const DEFAULT_QUALITY_PRESETS: QualityPreset[] = [
  { key: "schnell", label: "Schnell", infill: 15, layerHeight: 0.3, speedFactor: 0.7, desc: "Leicht & günstig" },
  { key: "standard", label: "Standard", infill: 20, layerHeight: 0.2, speedFactor: 1.0, desc: "Ausgewogen" },
  { key: "stark", label: "Stark", infill: 40, layerHeight: 0.15, speedFactor: 1.4, desc: "Belastbar" },
  { key: "massiv", label: "Massiv", infill: 80, layerHeight: 0.1, speedFactor: 2.0, desc: "Maximale Festigkeit" },
];

export const DEFAULT_CALC_PARAMS: CalcParams = {
  fix_cost: 3.5,
  support_surcharge: 2.5,
  min_price: 5,
};

export const QUALITY_PRESETS_KEY = "quality_presets";
export const CALC_PARAMS_KEY = "calc_params";

function num(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
}

export async function loadQualityConfig(): Promise<{ presets: QualityPreset[]; params: CalcParams }> {
  try {
    const { data } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", [QUALITY_PRESETS_KEY, CALC_PARAMS_KEY]);

    let presets = DEFAULT_QUALITY_PRESETS;
    let params = DEFAULT_CALC_PARAMS;

    for (const row of data || []) {
      if (row.key === QUALITY_PRESETS_KEY) {
        const parsed = JSON.parse(row.value);
        if (Array.isArray(parsed) && parsed.length > 0) {
          presets = DEFAULT_QUALITY_PRESETS.map((d) => {
            const p = parsed.find((x: any) => x?.key === d.key) || {};
            return {
              ...d,
              infill: num(p.infill, d.infill),
              layerHeight: num(p.layerHeight, d.layerHeight),
              speedFactor: num(p.speedFactor, d.speedFactor),
            };
          });
        }
      }
      if (row.key === CALC_PARAMS_KEY) {
        const parsed = JSON.parse(row.value) || {};
        params = {
          fix_cost: num(parsed.fix_cost, DEFAULT_CALC_PARAMS.fix_cost),
          support_surcharge: num(parsed.support_surcharge, DEFAULT_CALC_PARAMS.support_surcharge),
          min_price: num(parsed.min_price, DEFAULT_CALC_PARAMS.min_price),
        };
      }
    }
    return { presets, params };
  } catch (e) {
    console.warn("Qualitäts-Konfiguration konnte nicht geladen werden", e);
    return { presets: DEFAULT_QUALITY_PRESETS, params: DEFAULT_CALC_PARAMS };
  }
}

export async function saveQualityConfig(presets: QualityPreset[], params: CalcParams): Promise<void> {
  const now = new Date().toISOString();
  await supabase.from("settings").upsert(
    [
      { key: QUALITY_PRESETS_KEY, value: JSON.stringify(presets), updated_at: now },
      { key: CALC_PARAMS_KEY, value: JSON.stringify(params), updated_at: now },
    ],
    { onConflict: "key" },
  );
}
