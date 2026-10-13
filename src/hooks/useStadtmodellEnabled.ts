import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

let cached: boolean | null = null;
let pending: Promise<boolean> | null = null;
const listeners = new Set<(v: boolean) => void>();

function load(): Promise<boolean> {
  if (!pending) {
    pending = Promise.resolve(
      supabase.from("website_settings").select("value").eq("key", "stadtmodell_enabled").maybeSingle(),
    ).then(({ data }) => {
      // Ohne gespeicherten Wert ist der Konfigurator aktiv.
      const v = (data?.value as any)?.aktiv !== false;
      cached = v;
      listeners.forEach((l) => l(v));
      return v;
    }).catch(() => true);
  }
  return pending;
}

export function invalidateStadtmodellCache(): void {
  cached = null;
  pending = null;
  void load();
}

/** null = noch unbekannt */
export function useStadtmodellEnabled(): boolean | null {
  const [v, setV] = useState<boolean | null>(cached);
  useEffect(() => {
    listeners.add(setV);
    if (cached !== null) setV(cached); else load();
    return () => { listeners.delete(setV); };
  }, []);
  return v;
}
