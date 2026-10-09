import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { parseResinEnabled } from "@/lib/resin-content";
export { isResinText, stripResin } from "@/lib/resin-content";
export const ResinEnabledContext = createContext<boolean | null>(null);

// Einmal pro App-Start geladen, danach aus dem Cache geteilt.
let cached: boolean | null = null;
let pending: Promise<boolean> | null = null;
const listeners = new Set<(v: boolean) => void>();

function load(): Promise<boolean> {
  if (!pending) {
    pending = Promise.resolve(
      supabase.from("website_settings").select("value").eq("key", "resin_enabled").maybeSingle(),
    ).then(({ data, error }) => {
      const enabled = error ? false : parseResinEnabled(data?.value);
      cached = enabled;
      listeners.forEach((l) => l(enabled));
      return enabled;
    }).catch(() => { cached = false; listeners.forEach((l) => l(false)); return false; });
  }
  return pending;
}

/** Verwirft den Cache und lädt den Wert sofort neu aus der Datenbank. */
export function invalidateResinCache(): void {
  cached = null;
  pending = null;
  void load();
}

export function useResinEnabled(): boolean {
  const provided = useContext(ResinEnabledContext);
  const [enabled, setEnabled] = useState<boolean>(false);
  useEffect(() => {
    if (provided !== null) return;
    listeners.add(setEnabled);
    if (cached !== null) setEnabled(cached);
    else load();
    return () => { listeners.delete(setEnabled); };
  }, [provided]);
  return provided ?? enabled;
}
