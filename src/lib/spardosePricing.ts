import { baueFarbenMap } from "@/lib/material-farben";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_CALC_PARAMS, loadQualityConfig, loadWebsitePreise, type CalcParams } from "@/lib/calcConfig";
import { loadSettings } from "@/lib/calc";
import { DEFAULT_VERSAND, berechneVersand, loadVersandConfig, type VersandConfig } from "@/lib/versandConfig";

// Preisberechnung des Spardose-Generators: gleiche Bausteine und Einstellungen wie der Online-Kalkulator
// (Material, Maschinenzeit, Stützen-Zuschlag, Setup 1× pro Bestellung, Versand nach Gewicht, Mindestpreis, Gutschein).

export type PricingContext = {
  maschinenRate: number;      // CHF pro Stunde
  setup: number;              // CHF pro Bestellung
  supportZuschlag: number;    // CHF pro Platte mit Stützen
  minPreis: number;
  plaPreisProG: Record<string, number>; // Farbname (klein) -> CHF/g
  plaDurchschnitt: number;
  versandCfg: VersandConfig;
  nbRate: number;                       // Nachbearbeitung CHF/h (Admin), für "Stützen entfernen" in Stunden
  plaFilamentId: Record<string, string>; // Farbname/Hex -> filaments.id
};

export async function loadPricingContext(): Promise<PricingContext> {
  const [{ params }, web, settings, fil, versandCfg] = await Promise.all([
    loadQualityConfig().catch(() => ({ params: DEFAULT_CALC_PARAMS as CalcParams })),
    loadWebsitePreise().catch(() => ({ maschinenzeit_pro_h: null, setup_pauschale: null })),
    loadSettings().catch(() => null),
    supabase.from("filaments").select("id, material, farbe, farben, verkaufspreis_pro_g, public_preis_pro_g").eq("aktiv", true).eq("nur_intern", false).ilike("material", "PLA"),
    loadVersandConfig().catch(() => DEFAULT_VERSAND),
  ]);
  const proFarbe: Record<string, number> = {};
  const idMap: Record<string, string> = {};
  const preise: number[] = [];
  for (const f of (fil.data ?? []) as any[]) {
    const p = Number(f.verkaufspreis_pro_g ?? f.public_preis_pro_g ?? 0);
    if (!(p > 0)) continue;
    preise.push(p);
    const farben = baueFarbenMap([f])["PLA"] ?? [];
    farben.forEach((c) => { proFarbe[c.name.trim().toLowerCase()] = p; proFarbe[c.hex.trim().toLowerCase()] = p; idMap[c.name.trim().toLowerCase()] = f.id; idMap[c.hex.trim().toLowerCase()] = f.id; });
  }
  return {
    maschinenRate: web.maschinenzeit_pro_h ?? (settings?.maschinenzeit_pro_h || 3),
    setup: web.setup_pauschale ?? (params.fix_cost || 20),
    supportZuschlag: params.support_surcharge || 2.5,
    minPreis: params.min_price || 5,
    versandCfg,
    nbRate: settings?.nachbearbeitung_pro_h || 0,
    plaFilamentId: idMap,
    plaPreisProG: proFarbe,
    plaDurchschnitt: preise.length ? preise.reduce((a, b) => a + b, 0) / preise.length : 0.06,
  };
}

export type PreisZeile = { label: string; hex: string; gramm: number; proG: number; filamentId: string | null; stuetzenH: number; min: number; sup: boolean; material: number; maschine: number; support: number; summe: number };
export type Preis = {
  zeilen: PreisZeile[]; teile: number; setup: number; zwischensumme: number; versand: number; verpackung: number; versandTarif: number; total: number; mindestpreisGreift: boolean;
};

export function berechnePreis(
  ctx: PricingContext,
  jobs: { label: string; hex: string; g: number; min: number; sup: boolean }[],
  rabatt: (zwischensumme: number, versand: number) => number = () => 0,
): Preis & { rabatt: number; totalMitRabatt: number } {
  const zeilen: PreisZeile[] = jobs.map((j) => {
    const proG = ctx.plaPreisProG[j.hex.trim().toLowerCase()] ?? ctx.plaPreisProG[j.label.trim().toLowerCase()] ?? ctx.plaDurchschnitt;
    const material = j.g * proG;
    const maschine = (j.min / 60) * ctx.maschinenRate;
    const support = j.sup ? ctx.supportZuschlag : 0;
    const filamentId = ctx.plaFilamentId[j.hex.trim().toLowerCase()] ?? ctx.plaFilamentId[j.label.trim().toLowerCase()] ?? null;
    const stuetzenH = j.sup && ctx.nbRate > 0 ? Math.round((ctx.supportZuschlag / ctx.nbRate) * 1000) / 1000 : 0;
    return { label: j.label, hex: j.hex, gramm: j.g, proG, filamentId, stuetzenH, min: j.min, sup: j.sup, material, maschine, support, summe: material + maschine + support };
  });
  const teile = zeilen.reduce((s, z) => s + z.summe, 0);
  const zwischensumme = teile + ctx.setup;
  const grammGesamt = zeilen.reduce((s, z) => s + z.gramm, 0);
  const vs = berechneVersand(ctx.versandCfg, grammGesamt, zwischensumme);
  const versand = zwischensumme === 0 ? 0 : vs.versand + vs.verpackung; // Versand inkl. Verpackung = ein Preis
  const verpackung = zwischensumme === 0 ? 0 : vs.verpackung;
  const roh = zwischensumme + versand;
  const total = Math.max(roh, ctx.minPreis);
  const r = Math.min(rabatt(zwischensumme, versand), total);
  return { zeilen, teile, setup: ctx.setup, zwischensumme, versand, verpackung, versandTarif: Math.max(versand - verpackung, 0), total, mindestpreisGreift: roh < ctx.minPreis, rabatt: r, totalMitRabatt: Math.max(total - r, 0) };
}
