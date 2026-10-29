import { supabase } from "@/integrations/supabase/client";

/**
 * Einheitliche Umsatz-Definition für Dashboard, Finanzen und Umsatz-Analyse:
 * Umsatz zählt, sobald ein Auftrag bezahlt ist (Status ab "Bezahlt"), ohne Anfrage, Offerte und Storniert.
 * Der Monat richtet sich nach dem Zahlungsdatum (erster Statuswechsel auf "Bezahlt" im Verlauf);
 * fehlt der Eintrag, gilt das Auftragsdatum.
 */
export const UMSATZ_STATUS = [
  "Bezahlt", "Im Druck", "In Bearbeitung", "Qualitätsprüfung", "Versandt", "Geliefert", "Abgeschlossen",
];

export const istUmsatz = (status: string | null | undefined) => UMSATZ_STATUS.includes(status ?? "");

export interface UmsatzAuftrag {
  id: string;
  name: string;
  datum: string | null;
  status: string;
  umsatz: number;
  kosten: number;
  gewinn: number;
  kunde: string;
  /** Datum, nach dem der Monat zugeordnet wird (lokal, YYYY-MM-DD) */
  zahlDatum: string;
  zahlDatumQuelle: "zahlung" | "auftrag";
}

const pad = (n: number) => String(n).padStart(2, "0");

export function lokalesDatum(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function monatKey(datum: string): string {
  return datum.substring(0, 7);
}
export function monatLabel(key: string, lang: "kurz" | "lang" = "kurz"): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("de-CH", lang === "lang" ? { month: "long", year: "numeric" } : { month: "short", year: "2-digit" });
}
export function monatVerschieben(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
export function aktuellerMonat(): string {
  const n = new Date();
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}`;
}
/** Alle Monate von start bis end (inklusive), lückenlos */
export function monateZwischen(start: string, end: string): string[] {
  const out: string[] = [];
  let k = start;
  let guard = 0;
  while (k <= end && guard++ < 600) { out.push(k); k = monatVerschieben(k, 1); }
  return out;
}

function kundeName(c: any): string {
  if (!c) return "Kein Kunde";
  return c.firma || [c.vorname, c.name].filter(Boolean).join(" ").trim() || c.email || "Kunde ohne Name";
}

/** Lädt alle Aufträge, die zum Umsatz zählen, mit Zahlungsdatum */
export async function ladeUmsatzAuftraege(): Promise<UmsatzAuftrag[]> {
  const [{ data: orders }, { data: logs }] = await Promise.all([
    supabase.from("orders")
      .select("id, name, beschreibung, datum, created_at, status, umsatz_total, kosten_total, gewinn_total, customers(name, vorname, firma, email)")
      .in("status", UMSATZ_STATUS),
    (supabase.from as any)("order_status_log").select("order_id, created_at").eq("status", "Bezahlt").order("created_at", { ascending: true }),
  ]);
  const zahl = new Map<string, string>();
  for (const l of (logs ?? []) as { order_id: string; created_at: string }[]) {
    if (!zahl.has(l.order_id)) zahl.set(l.order_id, lokalesDatum(new Date(l.created_at)));
  }
  return ((orders ?? []) as any[]).map((o) => {
    const ausLog = zahl.get(o.id);
    const auftragsDatum = (o.datum as string | null) || (o.created_at ? lokalesDatum(new Date(o.created_at)) : lokalesDatum(new Date()));
    const umsatz = Number(o.umsatz_total) || 0;
    const kosten = Number(o.kosten_total) || 0;
    return {
      id: o.id,
      name: o.name || o.beschreibung || "Ohne Titel",
      datum: o.datum ?? null,
      status: o.status ?? "",
      umsatz,
      kosten,
      gewinn: o.gewinn_total != null ? Number(o.gewinn_total) || 0 : umsatz - kosten,
      kunde: kundeName(o.customers),
      zahlDatum: ausLog ?? auftragsDatum,
      zahlDatumQuelle: ausLog ? "zahlung" : "auftrag",
    } as UmsatzAuftrag;
  });
}

export interface MonatsSumme {
  key: string;
  umsatz: number;
  gewinn: number;
  anzahl: number;
}

/** Monatssummen, lückenlos von von..bis (leere Monate = 0) */
export function monatsSummen(auftraege: UmsatzAuftrag[], von: string, bis: string): MonatsSumme[] {
  const map = new Map<string, MonatsSumme>();
  monateZwischen(von, bis).forEach((k) => map.set(k, { key: k, umsatz: 0, gewinn: 0, anzahl: 0 }));
  for (const a of auftraege) {
    const m = map.get(monatKey(a.zahlDatum));
    if (!m) continue;
    m.umsatz += a.umsatz;
    m.gewinn += a.gewinn;
    m.anzahl += 1;
  }
  return Array.from(map.values()).map((m) => ({ ...m, umsatz: Math.round(m.umsatz * 100) / 100, gewinn: Math.round(m.gewinn * 100) / 100 }));
}

export function aenderung(neu: number, alt: number): number | null {
  if (!alt) return null;
  return ((neu - alt) / alt) * 100;
}
