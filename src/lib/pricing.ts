// Eine einzige Preisformel fuer alle Kalkulatoren (Website, Test, Auftrag, spaeter die Analyse).
// Bildet die bisherige Rechnung des Website-Kalkulators (Slicer-Pfad) 1:1 ab, damit sich beim Umstellen kein Preis aendert.
import { schaetzeNachbearbeitungMin } from "@/lib/nachbearbeitung";
import { splitFee } from "@/lib/splitSurcharge";
import type { Mass3 } from "@/lib/versandArt";

export interface PreisConfig {
  maschinenzeitProH: number;
  nachbearbeitungProH: number;
  /** Setup-Pauschale pro Druckerbestueckung (bei Mengen pro Platte) */
  setupPauschale: number;
  mindestpreis: number;
}

export type PreisQuelle = "website" | "intern" | "standard";
export interface PreisConfigAufgeloest extends PreisConfig {
  quelle: Record<keyof PreisConfig, PreisQuelle>;
}

/** Wie der Website-Kalkulator seine Werte heute auswaehlt: Website-Preis > interne Einstellung > fester Standard. */
export function loesePreisConfigAuf(i: {
  website: { maschinenzeit_pro_h: number | null; setup_pauschale: number | null; nachbearbeitung_pro_h: number | null };
  settings: { maschinenzeit_pro_h?: number; nachbearbeitung_pro_h?: number };
  calcParams: { fix_cost?: number; min_price?: number };
}): PreisConfigAufgeloest {
  const wahl = (web: number | null, intern: number | undefined, std: number): [number, PreisQuelle] =>
    web != null ? [web, "website"] : intern ? [intern, "intern"] : [std, "standard"];
  const [m, qm] = wahl(i.website.maschinenzeit_pro_h, i.settings.maschinenzeit_pro_h, 3);
  const [n, qn] = wahl(i.website.nachbearbeitung_pro_h, i.settings.nachbearbeitung_pro_h, 50);
  const [s, qs] = wahl(i.website.setup_pauschale, i.calcParams.fix_cost, 20);
  const [p, qp] = wahl(null, i.calcParams.min_price, 5);
  return {
    maschinenzeitProH: m, nachbearbeitungProH: n, setupPauschale: s, mindestpreis: p,
    quelle: { maschinenzeitProH: qm, nachbearbeitungProH: qn, setupPauschale: qs, mindestpreis: qp },
  };
}

export interface PreisTeil {
  gewichtG: number;
  druckzeitMin: number;
  materialProG: number;
  menge: number;
  hasSupport?: boolean;
  dims?: Mass3 | null;
  triangles?: number | null;
  volumeCm3?: number | null;
  /** Anzahl Teile, in die das Modell geteilt wird (>1 = Zuschlag pro Schnitt) */
  splitParts?: number | null;
  /** Nachbearbeitung direkt vorgeben (Minuten pro Stueck), sonst geschaetzt */
  nachbearbeitungMin?: number;
}

export interface PreisStueck { material: number; maschine: number; nachbearbeitung: number; teilen: number; stueck: number }

export function preisProStueck(t: PreisTeil, c: PreisConfig): PreisStueck {
  const material = t.gewichtG * t.materialProG;
  const maschine = (t.druckzeitMin / 60) * c.maschinenzeitProH;
  const min = t.nachbearbeitungMin ?? schaetzeNachbearbeitungMin({ hasSupport: !!t.hasSupport, dims: t.dims ?? null, triangles: t.triangles, volumeCm3: t.volumeCm3 });
  const nachbearbeitung = (min / 60) * c.nachbearbeitungProH;
  const teilen = splitFee(t.splitParts);
  return { material, maschine, nachbearbeitung, teilen, stueck: material + maschine + nachbearbeitung + teilen };
}

export interface PreisAuftrag {
  teile: (PreisStueck & { menge: number; summe: number })[];
  setup: number;
  zwischensumme: number;
  versand: number;
  total: number;
}

/** platten: Anzahl Druckerbestueckungen laut Slicer (mind. 1). versand: bereits gewaehlte Versandkosten. */
export function preisAuftrag(teile: PreisTeil[], c: PreisConfig, opt: { platten?: number; versand: number }): PreisAuftrag {
  const rows = teile.map((t) => {
    const s = preisProStueck(t, c);
    return { ...s, menge: t.menge, summe: Math.max(s.stueck * t.menge, 0) };
  });
  const setup = rows.length > 0 ? c.setupPauschale * Math.max(1, opt.platten ?? 0) : 0;
  const zwischensumme = rows.reduce((s, r) => s + r.summe, 0) + setup;
  const versand = zwischensumme === 0 ? 0 : opt.versand;
  return { teile: rows, setup, zwischensumme, versand, total: Math.max(zwischensumme + versand, c.mindestpreis || 5) };
}
