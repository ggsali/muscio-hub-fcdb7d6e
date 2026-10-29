import { supabase } from "@/integrations/supabase/client";

export interface Schicht {
  id: string;
  start_at: string;
  ende_at: string | null;
  notiz: string | null;
}

export const STEMPEL_KEY = "stempel_code";

export async function ladeSchichten(seit?: Date): Promise<Schicht[]> {
  let q = (supabase.from as any)("arbeitszeit").select("id, start_at, ende_at, notiz").order("start_at", { ascending: false }).limit(2000);
  if (seit) q = q.gte("start_at", seit.toISOString());
  const { data } = await q;
  return (data ?? []) as Schicht[];
}

/** Dauer einer Schicht in Stunden; offene Schichten zählen bis jetzt */
export function schichtStunden(s: Schicht, jetzt = Date.now()): number {
  const ende = s.ende_at ? new Date(s.ende_at).getTime() : jetzt;
  return Math.max(0, (ende - new Date(s.start_at).getTime()) / 3600000);
}

export function formatDauer(stunden: number): string {
  const min = Math.round(stunden * 60);
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;
}

/** Stunden eines Monats (YYYY-MM), nach Startzeit der Schicht (lokal) */
export function stundenImMonat(schichten: Schicht[], monat: string): number {
  return schichten
    .filter((s) => {
      const d = new Date(s.start_at);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === monat;
    })
    .reduce((sum, s) => sum + schichtStunden(s), 0);
}

/** Wert für <input type="datetime-local"> in lokaler Zeit */
export function zuLokalInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
