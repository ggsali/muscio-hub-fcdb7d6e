import { schaetzeNachbearbeitungMin } from "@/lib/nachbearbeitung";
import { splitFee } from "@/lib/splitSurcharge";
import { loadSettings } from "@/lib/calc";
import { loadQualityConfig, loadWebsitePreise, type QualityPreset } from "@/lib/calcConfig";
import { sliceOnNas, type NasResult } from "@/pages/KalkulatorTestPage";
import type { Mass3 } from "@/lib/versandArt";

/* ------------------------------------------------------------------ *
 * Labor: Bausteine für /labor/ablauf. Nichts hiervon liest oder schreibt Kundendaten,
 * sendet Mails oder stellt etwas in die SimplyPrint-Queue.
 * ------------------------------------------------------------------ */

/** Grösstes Druckbett (mm): grössere Teile werden vom Server geteilt */
export const BAUBREITE_MAX_MM = 420;

/**
 * Slicen im Labor. Der Parameter enqueue ist fest false und lässt sich von aussen nicht setzen:
 * im Labor wird nie etwas eingereiht.
 */
export function sliceImLabor(file: File, layerHeight: number, infill: number, orient: boolean): Promise<NasResult> {
  return sliceOnNas(file, layerHeight, infill, false, { orient, allowSplit: true });
}

/** Sicherheitsnetz: meldet, falls der Server trotz enqueue=false etwas eingereiht hat */
export function wurdeEingereiht(r: NasResult | null | undefined): boolean {
  return !!(r?.nas?.queued || r?.nas?.queueItemId);
}

/* ---------------------------- Ausrichtungsvergleich ---------------------------- */

export interface SliceKurz {
  druckzeitMin: number;
  gramm: number;
  schichten: number;
  hatStuetzen: boolean;
  /** Stützmaterial in g, falls der Server es liefert */
  stuetzGramm: number | null;
  splitParts: number | null;
}

export function kurz(r: NasResult): SliceKurz {
  const sg = Number(r.rawStats?.support_g ?? r.rawStats?.support_filament_g);
  return {
    druckzeitMin: r.printTimeMinutes,
    gramm: r.filamentGrams,
    schichten: r.layers,
    hatStuetzen: r.hasSupport,
    stuetzGramm: Number.isFinite(sg) ? sg : null,
    splitParts: r.splitParts ?? null,
  };
}

export type Gewinner = "mit" | "ohne" | "gleich" | "unklar";

/** Besser = kürzere Druckzeit bei gleicher oder kleinerer Stützmenge. Ohne gelieferte Stützgramm: Stützen ja/nein, dann Filamentgramm (1 % Toleranz). */
export function vergleiche(mit: SliceKurz, ohne: SliceKurz): { gewinner: Gewinner; grund: string } {
  const zeitTol = Math.max(0.5, Math.max(mit.druckzeitMin, ohne.druckzeitMin) * 0.005);
  const dz = mit.druckzeitMin - ohne.druckzeitMin;
  if (Math.abs(dz) <= zeitTol) return { gewinner: "gleich", grund: "Druckzeit praktisch gleich" };
  const stuetzNichtMehr = (a: SliceKurz, b: SliceKurz) =>
    a.stuetzGramm != null && b.stuetzGramm != null
      ? a.stuetzGramm <= b.stuetzGramm
      : Number(a.hatStuetzen) <= Number(b.hatStuetzen) && a.gramm <= b.gramm * 1.01;
  const kurzer: "mit" | "ohne" = dz < 0 ? "mit" : "ohne";
  const a = kurzer === "mit" ? mit : ohne;
  const b = kurzer === "mit" ? ohne : mit;
  if (stuetzNichtMehr(a, b)) {
    return { gewinner: kurzer, grund: `kürzere Druckzeit (${Math.abs(dz).toFixed(0)} min) bei gleicher oder kleinerer Stützmenge` };
  }
  return { gewinner: "unklar", grund: "Eine Variante ist schneller, braucht aber mehr Stützen: kein eindeutiger Gewinner" };
}

/* ---------------------------------- Preis ---------------------------------- */

export interface LaborPreisKonfig {
  maschinenRate: number;
  nachbearbeitungRate: number;
  setupPauschale: number;
  minPrice: number;
  presets: QualityPreset[];
}

/** Lädt dieselben Preisgrundlagen wie der Kalkulator (Website-Preise vor Admin-Einstellungen vor Standardwert) */
export async function ladeLaborPreisKonfig(): Promise<LaborPreisKonfig> {
  const [settings, wp, cfg] = await Promise.all([loadSettings(), loadWebsitePreise(), loadQualityConfig()]);
  return {
    maschinenRate: wp.maschinenzeit_pro_h ?? (settings.maschinenzeit_pro_h || 3),
    nachbearbeitungRate: wp.nachbearbeitung_pro_h ?? (settings.nachbearbeitung_pro_h || 50),
    setupPauschale: wp.setup_pauschale ?? (cfg.params.fix_cost || 20),
    minPrice: cfg.params.min_price || 5,
    presets: cfg.presets,
  };
}

export interface PreisTeil {
  gramm: number;
  druckzeitMin: number;
  pricePerGram: number;
  hasSupport: boolean;
  dims: Mass3 | null;
  triangles: number | null;
  volumeCm3: number | null;
  splitParts: number | null;
  menge: number;
}

export interface PreisErgebnis {
  material: number;
  maschine: number;
  nachbearbeitung: number;
  nachbearbeitungMin: number;
  teilung: number;
  proStueck: number;
  teilsumme: number;
}

/** Stückpreis aus Slicer-Daten: Material + Maschinenzeit + Nachbearbeitung + Teilungszuschlag (wie der Online-Kalkulator) */
export function laborPreis(t: PreisTeil, k: LaborPreisKonfig): PreisErgebnis {
  const material = t.gramm * t.pricePerGram;
  const maschine = (t.druckzeitMin / 60) * k.maschinenRate;
  const nachbearbeitungMin = schaetzeNachbearbeitungMin({ hasSupport: t.hasSupport, dims: t.dims, triangles: t.triangles, volumeCm3: t.volumeCm3 });
  const nachbearbeitung = (nachbearbeitungMin / 60) * k.nachbearbeitungRate;
  const teilung = splitFee(t.splitParts);
  const proStueck = material + maschine + nachbearbeitung + teilung;
  return { material, maschine, nachbearbeitung, nachbearbeitungMin, teilung, proStueck, teilsumme: Math.max(proStueck * t.menge, 0) };
}

/** Nächstliegender Qualitäts-Preset (nach Schichthöhe) für den Standard-Füllgrad */
export function standardInfill(presets: QualityPreset[], layerHeight: number): number {
  const p = presets.reduce((best, x) => (Math.abs(x.layerHeight - layerHeight) < Math.abs(best.layerHeight - layerHeight) ? x : best), presets[0]);
  return p?.infill ?? 20;
}

/* ---------------------------------- Hilfen ---------------------------------- */

export function base64ZuBlobUrl(base64: string, mime = "application/pdf"): string {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}

export async function dateiZuBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) s += String.fromCharCode(...buf.subarray(i, i + chunk));
  return btoa(s);
}
