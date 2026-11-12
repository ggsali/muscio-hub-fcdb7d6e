import { supabase } from "@/integrations/supabase/client";

/**
 * Einheitliche Umsatz-Definition für Dashboard, Finanzen und Umsatz-Analyse:
 * Umsatz zählt, sobald ein Auftrag bezahlt ist (Status ab "Bezahlt"), ohne Anfrage, Offerte und Storniert.
 * Der Monat richtet sich nach dem Zahlungsdatum, nie nach dem Auftragsmonat:
 * 1. orders.bezahlt_am (von dir eingetragen oder beim Bestätigen der Zahlung gesetzt)
 * 2. sonst der erste Verlaufs-Eintrag ab Status "Bezahlt"
 * 3. nur wenn beides fehlt, ersatzweise das Auftragsdatum (in der Analyse als "Zahlungsdatum unbekannt" markiert).
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
  zahlDatumQuelle: "manuell" | "zahlung" | "auftrag" | "teilzahlung";
  /** false bei weiteren Einträgen desselben Auftrags (Teilzahlungen), damit Aufträge nur einmal gezählt werden */
  zaehlt?: boolean;
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

/** Lädt alle Umsatz-Einträge: pro Auftrag der Rest (ab Status "Bezahlt") und jede Teilzahlung mit ihrem eigenen Datum.
 *  Ein Auftrag ohne Teilzahlungen ergibt wie bisher genau einen Eintrag über den ganzen Betrag. */
export async function ladeUmsatzAuftraege(): Promise<UmsatzAuftrag[]> {
  const [{ data: ordersStatus }, { data: logs }, { data: zahlungen }] = await Promise.all([
    (supabase.from as any)("orders")
      .select("id, name, beschreibung, datum, bezahlt_am, created_at, status, umsatz_total, kosten_total, gewinn_total, customers(name, vorname, firma, email)")
      .in("status", UMSATZ_STATUS),
    (supabase.from as any)("order_status_log").select("order_id, created_at").in("status", UMSATZ_STATUS).order("created_at", { ascending: true }),
    (supabase.from as any)("order_payments").select("order_id, betrag, datum").order("datum", { ascending: true }),
  ]);
  const proAuftrag = new Map<string, { betrag: number; datum: string }[]>();
  for (const z of (zahlungen ?? []) as { order_id: string; betrag: number | string; datum: string }[]) {
    const l = proAuftrag.get(z.order_id) ?? [];
    l.push({ betrag: Number(z.betrag) || 0, datum: z.datum });
    proAuftrag.set(z.order_id, l);
  }
  // Aufträge mit Teilzahlung, die noch nicht im Status "Bezahlt" sind, gehören ebenfalls dazu
  const bekannt = new Set(((ordersStatus ?? []) as any[]).map((o) => o.id));
  const fehlend = [...proAuftrag.keys()].filter((id) => !bekannt.has(id));
  let nurTeil: any[] = [];
  if (fehlend.length > 0) {
    const { data } = await (supabase.from as any)("orders")
      .select("id, name, beschreibung, datum, bezahlt_am, created_at, status, umsatz_total, kosten_total, gewinn_total, customers(name, vorname, firma, email)")
      .in("id", fehlend);
    nurTeil = (data ?? []) as any[];
  }
  const zahl = new Map<string, string>();
  for (const l of (logs ?? []) as { order_id: string; created_at: string }[]) {
    if (!zahl.has(l.order_id)) zahl.set(l.order_id, lokalesDatum(new Date(l.created_at)));
  }
  const out: UmsatzAuftrag[] = [];
  for (const o of [...((ordersStatus ?? []) as any[]), ...nurTeil]) {
    const manuell = (o.bezahlt_am as string | null) || null;
    const ausLog = manuell ? undefined : zahl.get(o.id);
    const auftragsDatum = (o.datum as string | null) || (o.created_at ? lokalesDatum(new Date(o.created_at)) : lokalesDatum(new Date()));
    const total = Number(o.umsatz_total) || 0;
    const kosten = Number(o.kosten_total) || 0;
    const gewinnTotal = o.gewinn_total != null ? Number(o.gewinn_total) || 0 : total - kosten;
    const basis = {
      id: o.id as string,
      name: (o.name || o.beschreibung || "Ohne Titel") as string,
      datum: (o.datum ?? null) as string | null,
      status: (o.status ?? "") as string,
      kunde: kundeName(o.customers),
    };
    const teile = proAuftrag.get(o.id) ?? [];
    const bezahltSumme = teile.reduce((s, t) => s + t.betrag, 0);
    const anteil = (betrag: number) => (total > 0 ? betrag / total : 0);
    let erster = true;
    for (const t of teile) {
      out.push({ ...basis, umsatz: t.betrag, kosten: kosten * anteil(t.betrag), gewinn: gewinnTotal * anteil(t.betrag), zahlDatum: t.datum, zahlDatumQuelle: "teilzahlung", zaehlt: erster });
      erster = false;
    }
    if (istUmsatz(o.status)) {
      const rest = teile.length > 0 ? Math.round((total - bezahltSumme) * 100) / 100 : total;
      if (teile.length === 0 || rest > 0.004) {
        const r = teile.length > 0 ? rest : total;
        out.push({
          ...basis, umsatz: r,
          kosten: teile.length > 0 ? kosten * anteil(r) : kosten,
          gewinn: teile.length > 0 ? gewinnTotal * anteil(r) : gewinnTotal,
          zahlDatum: manuell ?? ausLog ?? auftragsDatum,
          zahlDatumQuelle: manuell ? "manuell" : ausLog ? "zahlung" : "auftrag",
          zaehlt: erster,
        });
      }
    }
  }
  return out;
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
    if (a.zaehlt !== false) m.anzahl += 1;
  }
  return Array.from(map.values()).map((m) => ({ ...m, umsatz: Math.round(m.umsatz * 100) / 100, gewinn: Math.round(m.gewinn * 100) / 100 }));
}

export function aenderung(neu: number, alt: number): number | null {
  if (!alt) return null;
  return ((neu - alt) / alt) * 100;
}
