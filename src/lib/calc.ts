import { supabase } from "@/integrations/supabase/client";

export interface Settings {
  setup_pauschale: number;
  material_verkauf_pro_g: number;
  maschinenzeit_pro_h: number;
  nachbearbeitung_pro_h: number;
  konstruktion_pro_h: number;
  material_einkauf_pro_kg: number;
  strom_verschleiss_pro_h: number;
  skalierungsziel: number;
  investitions_fonds_prozent: number;
}

export const DEFAULT_SETTINGS: Settings = {
  setup_pauschale: 20,
  material_verkauf_pro_g: 0.055,
  maschinenzeit_pro_h: 3.00,
  nachbearbeitung_pro_h: 50.00,
  konstruktion_pro_h: 65.00,
  material_einkauf_pro_kg: 25.00,
  strom_verschleiss_pro_h: 0.80,
  skalierungsziel: 1500,
  investitions_fonds_prozent: 20,
};

export async function loadSettings(): Promise<Settings> {
  const { data } = await supabase.from("settings").select("*");
  if (!data || data.length === 0) return DEFAULT_SETTINGS;
  const s: Partial<Settings> = {};
  for (const row of data) {
    (s as Record<string, number>)[row.key] = parseFloat(row.value);
  }
  return { ...DEFAULT_SETTINGS, ...s };
}

export async function saveSettings(settings: Settings): Promise<void> {
  const entries = Object.entries(settings).map(([key, value]) => ({
    key,
    value: String(value),
    updated_at: new Date().toISOString(),
  }));
  for (const entry of entries) {
    await supabase.from("settings").upsert(entry, { onConflict: "key" });
  }
}

export function calcUmsatz(
  s: Settings,
  gewicht: number,
  druckzeit: number,
  nachbearbeitung: number,
  konstruktion: number
): number {
  return (
    s.setup_pauschale +
    gewicht * s.material_verkauf_pro_g +
    druckzeit * s.maschinenzeit_pro_h +
    nachbearbeitung * s.nachbearbeitung_pro_h +
    konstruktion * s.konstruktion_pro_h
  );
}

export function calcKosten(s: Settings, gewicht: number, druckzeit: number): number {
  return (gewicht / 1000) * s.material_einkauf_pro_kg + druckzeit * s.strom_verschleiss_pro_h;
}

export function calcGewinn(umsatz: number, kosten: number): number {
  return umsatz - kosten;
}

export function calcMarge(gewinn: number, umsatz: number): number {
  if (umsatz === 0) return 0;
  return (gewinn / umsatz) * 100;
}

export function formatCHF(value: number): string {
  return `CHF ${value.toFixed(2)}`;
}

export function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}
