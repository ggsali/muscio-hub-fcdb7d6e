import { supabase } from "@/integrations/supabase/client";

export interface Fixkosten {
  id: string;
  name: string;
  kategorie: string;
  betrag: number;
  intervall: "monatlich" | "jaehrlich";
  gueltig_ab: string | null;
  gueltig_bis: string | null;
  notiz: string | null;
}

export const FIXKOSTEN_KATEGORIEN = ["Software/Abos", "Abschreibung", "Versicherung", "Raum/Strom", "Sonstiges"];

export async function ladeFixkosten(): Promise<Fixkosten[]> {
  const { data } = await (supabase.from as any)("fixkosten").select("*").order("kategorie").order("name");
  return ((data ?? []) as any[]).map((f) => ({ ...f, betrag: Number(f.betrag) || 0 })) as Fixkosten[];
}

/** Kosten dieser Position in einem Monat (YYYY-MM): jährliche Beträge zu 1/12, nur innerhalb von gueltig_ab/gueltig_bis */
export function fixkostenImMonat(f: Fixkosten, monat: string): number {
  const start = `${monat}-01`;
  const [y, m] = monat.split("-").map(Number);
  const ende = `${monat}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
  if (f.gueltig_ab && f.gueltig_ab > ende) return 0;
  if (f.gueltig_bis && f.gueltig_bis < start) return 0;
  return f.intervall === "jaehrlich" ? f.betrag / 12 : f.betrag;
}

export function fixkostenSumme(liste: Fixkosten[], monat: string): number {
  return liste.reduce((s, f) => s + fixkostenImMonat(f, monat), 0);
}

/** Vorschläge mit ungefähren CHF-Beträgen (bitte prüfen und anpassen) */
export const FIXKOSTEN_VORSCHLAEGE: Omit<Fixkosten, "id">[] = [
  { name: "Drucker-Abschreibung (CHF 5'042 über 3 Jahre)", kategorie: "Abschreibung", betrag: 140, intervall: "monatlich", gueltig_ab: null, gueltig_bis: null, notiz: "H2C 2600, K2 Plus 1123, A1 450, K1C 460, K1 409" },
  { name: "Lovable", kategorie: "Software/Abos", betrag: 23, intervall: "monatlich", gueltig_ab: null, gueltig_bis: null, notiz: "25 EUR pro Monat" },
  { name: "SimplyPrint (mit 30 % Rabatt)", kategorie: "Software/Abos", betrag: 23, intervall: "monatlich", gueltig_ab: null, gueltig_bis: "2027-01-11", notiz: "28.83 USD, Rabatt 3 Monate" },
  { name: "SimplyPrint (regulär)", kategorie: "Software/Abos", betrag: 33, intervall: "monatlich", gueltig_ab: "2027-01-12", gueltig_bis: null, notiz: "41.19 USD nach Rabatt" },
  { name: "IONOS", kategorie: "Software/Abos", betrag: 6, intervall: "monatlich", gueltig_ab: null, gueltig_bis: null, notiz: "6.36 EUR" },
];
