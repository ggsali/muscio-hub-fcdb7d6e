import { supabase } from "@/integrations/supabase/client";

/** Versandpreise und Verpackung – im Admin (Einstellungen → Versand) anpassbar, gespeichert in settings.versand_config */
export type VersandTarif = { name: string; bisKg: number; preis: number };
export type VersandConfig = {
  tarife: VersandTarif[];       // aufsteigend nach bisKg
  verpackung: number;           // CHF pro Bestellung (Karton, Füllmaterial, Klebeband)
  verpackungProKg: number;      // CHF zusätzlich pro kg Gewicht
  gratisAb: number | null;      // Versand gratis ab diesem Zwischensumme-Betrag (CHF), leer = nie
};

export const VERSAND_KEY = "versand_config";
export const DEFAULT_VERSAND: VersandConfig = {
  tarife: [
    { name: "PostPac Priority bis 2 kg", bisKg: 2, preis: 10.5 },
    { name: "PostPac Priority bis 10 kg", bisKg: 10, preis: 13.5 },
    { name: "PostPac Priority bis 30 kg", bisKg: 30, preis: 22.5 },
  ],
  verpackung: 0,
  verpackungProKg: 0,
  gratisAb: null,
};

const num = (v: unknown, d = 0) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : d; };

export function normalisiereVersand(raw: unknown): VersandConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as any;
  const tarife: VersandTarif[] = Array.isArray(r.tarife)
    ? r.tarife.map((t: any) => ({ name: String(t?.name ?? ""), bisKg: num(t?.bisKg), preis: num(t?.preis) })).filter((t: VersandTarif) => t.bisKg > 0)
    : [];
  tarife.sort((a, b) => a.bisKg - b.bisKg);
  return {
    tarife: tarife.length ? tarife : DEFAULT_VERSAND.tarife,
    verpackung: num(r.verpackung),
    verpackungProKg: num(r.verpackungProKg),
    gratisAb: r.gratisAb == null || r.gratisAb === "" ? null : num(r.gratisAb, 0) || null,
  };
}

export async function loadVersandConfig(): Promise<VersandConfig> {
  try {
    const { data } = await supabase.from("settings").select("value").eq("key", VERSAND_KEY).maybeSingle();
    if (data?.value) return normalisiereVersand(typeof data.value === "string" ? JSON.parse(data.value) : data.value);
  } catch (e) { console.warn("Versand-Konfiguration konnte nicht geladen werden", e); }
  return DEFAULT_VERSAND;
}

export async function saveVersandConfig(c: VersandConfig): Promise<void> {
  const { error } = await supabase.from("settings").upsert({ key: VERSAND_KEY, value: JSON.stringify(normalisiereVersand(c)), updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw error;
}

/** Versandkosten + Verpackung für ein Gesamtgewicht */
export function berechneVersand(c: VersandConfig, gramm: number, zwischensumme: number) {
  const kg = gramm / 1000;
  const tarif = c.tarife.find((t) => kg <= t.bisKg) ?? c.tarife[c.tarife.length - 1];
  const gratis = c.gratisAb != null && zwischensumme >= c.gratisAb;
  return {
    tarifName: tarif.name,
    versand: gratis ? 0 : tarif.preis,
    verpackung: c.verpackung + c.verpackungProKg * kg,
    gratis,
  };
}
