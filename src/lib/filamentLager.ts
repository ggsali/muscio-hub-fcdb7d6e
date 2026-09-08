import { supabase } from "@/integrations/supabase/client";

export interface FilamentType {
  id: string;
  material: string;
  farbe: string;
  hersteller: string | null;
  farbcode: string | null;
  mindestbestand: number;
  created_at: string;
}

export interface FilamentSpool {
  id: string;
  spool_code: string;
  filament_type_id: string;
  gewicht_g: number;
  status: string;
  printed: boolean;
  created_at: string;
  emptied_at: string | null;
}

export const typeLabel = (t: FilamentType) => `${t.material} · ${t.farbe}`;

export async function loadTypes(): Promise<FilamentType[]> {
  const { data, error } = await supabase
    .from("filament_types")
    .select("*")
    .order("material", { ascending: true })
    .order("farbe", { ascending: true });
  if (error) throw error;
  return (data || []) as FilamentType[];
}

export async function loadSpools(): Promise<FilamentSpool[]> {
  const { data, error } = await supabase
    .from("filament_spools")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as FilamentSpool[];
}

export function fullCountByType(spools: FilamentSpool[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const s of spools) {
    if (s.status === "voll") map[s.filament_type_id] = (map[s.filament_type_id] || 0) + 1;
  }
  return map;
}

/** Nächste fortlaufende Nummer aus dem höchsten bestehenden FIL-Code. */
export async function nextSpoolNumber(): Promise<number> {
  const { data, error } = await supabase
    .from("filament_spools")
    .select("spool_code")
    .order("spool_code", { ascending: false })
    .limit(500);
  if (error) throw error;
  let max = 0;
  for (const row of data || []) {
    const m = /^FIL-(\d+)$/.exec((row as any).spool_code || "");
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}

export const formatSpoolCode = (n: number) => `FIL-${String(n).padStart(4, "0")}`;

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min.`;
  const std = Math.round(min / 60);
  if (std < 24) return `vor ${std} Std.`;
  const tage = Math.round(std / 24);
  return tage === 1 ? "vor 1 Tag" : `vor ${tage} Tagen`;
}
