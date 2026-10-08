import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Einmal pro App-Start geladen, danach aus dem Cache geteilt.
let cached: boolean | null = null;
let pending: Promise<boolean> | null = null;
const listeners = new Set<(v: boolean) => void>();

function load(): Promise<boolean> {
  if (!pending) {
    pending = Promise.resolve(
      supabase.from("website_settings").select("value").eq("key", "resin_enabled").maybeSingle(),
    ).then(({ data }) => {
      const v = data?.value as any;
      const enabled = v == null ? true : typeof v === "boolean" ? v : v.aktiv !== false;
      cached = enabled;
      listeners.forEach((l) => l(enabled));
      return enabled;
    }).catch(() => { cached = true; return true; });
  }
  return pending;
}

export function isResinText(s?: string | null) {
  return !!s && /resin|\bsla\b/i.test(s);
}

/** Entfernt Formulierungen wie „FDM & SLA", „FDM und SLA/Resin" aus einem Text. */
export function stripResin(s: string): string {
  return s
    .replace(/\s*(?:&|und|sowie|,)\s*(?:im\s+)?SLA(?:\s*\/\s*Resin|[-\s]Resin)?(?:-Verfahren|-Druck)?/gi, "")
    .replace(/\s*(?:,|und|&)\s*(?:SLA-)?Resin\b/gi, "")
    .replace(/\s{2,}/g, " ");
}

export function useResinEnabled(): boolean {
  const [enabled, setEnabled] = useState<boolean>(cached ?? true);
  useEffect(() => {
    listeners.add(setEnabled);
    if (cached !== null) setEnabled(cached);
    else load();
    return () => { listeners.delete(setEnabled); };
  }, []);
  return enabled;
}
