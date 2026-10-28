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

/** Preise, die nur für den öffentlichen Website-Kalkulator gelten (Admin/Aufträge/PDF bleiben unberührt). */
export interface WebsitePreise {
  maschinenzeit_pro_h: number | null;
  setup_pauschale: number | null;
  /** Stundensatz Nachbearbeitung aus dem Admin (Einstellungen → Stundensätze), gilt auch für die Schätzung im Website-Kalkulator */
  nachbearbeitung_pro_h?: number | null;
}

export const WEBSITE_MASCHINENZEIT_KEY = "website_maschinenzeit_pro_h";
export const WEBSITE_SETUP_KEY = "website_setup_pauschale";
export const NACHBEARBEITUNG_KEY = "nachbearbeitung_pro_h";

/** Admin liest direkt aus "settings", Besucher über die freigegebene Funktion (nur diese zwei Keys). */
export async function loadWebsitePreise(): Promise<WebsitePreise> {
  const out: WebsitePreise = { maschinenzeit_pro_h: null, setup_pauschale: null, nachbearbeitung_pro_h: null };
  try {
    const { data } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", [WEBSITE_MASCHINENZEIT_KEY, WEBSITE_SETUP_KEY, NACHBEARBEITUNG_KEY]);
    let rows: { key: string; value: unknown }[] = data || [];
    if (rows.length === 0) {
      const { data: pub } = await (supabase.rpc as any)("get_website_calc_preise");
      if (pub && typeof pub === "object") {
        rows = Object.entries(pub as Record<string, unknown>).map(([key, value]) => ({ key, value }));
      }
    }
    for (const r of rows) {
      const n = parseFloat(String(r.value));
      if (!Number.isFinite(n) || n < 0) continue;
      if (r.key === WEBSITE_MASCHINENZEIT_KEY) out.maschinenzeit_pro_h = n;
      if (r.key === WEBSITE_SETUP_KEY) out.setup_pauschale = n;
      if (r.key === NACHBEARBEITUNG_KEY) out.nachbearbeitung_pro_h = n;
    }
  } catch (e) {
    console.warn("Website-Preise konnten nicht geladen werden", e);
  }
  return out;
}

export async function saveWebsitePreise(p: { maschinenzeit_pro_h: number | null; setup_pauschale: number | null }): Promise<void> {
  const now = new Date().toISOString();
  const rows: { key: string; value: string; updated_at: string }[] = [];
  if (p.maschinenzeit_pro_h != null) rows.push({ key: WEBSITE_MASCHINENZEIT_KEY, value: String(p.maschinenzeit_pro_h), updated_at: now });
  if (p.setup_pauschale != null) rows.push({ key: WEBSITE_SETUP_KEY, value: String(p.setup_pauschale), updated_at: now });
  if (rows.length === 0) return;
  await supabase.from("settings").upsert(rows, { onConflict: "key" });
}
