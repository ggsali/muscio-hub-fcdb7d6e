import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// website_settings.key = "weihnachtsmodus", value = { aktiv: boolean }
let cached: boolean | null = null;
let pending: Promise<boolean> | null = null;
const listeners = new Set<(v: boolean) => void>();

function load(): Promise<boolean> {
  if (!pending) {
    pending = Promise.resolve(
      supabase.from("website_settings").select("value").eq("key", "weihnachtsmodus").maybeSingle(),
    )
      .then(({ data, error }) => {
        const on = !error && (data?.value as any)?.aktiv === true;
        cached = on;
        listeners.forEach((l) => l(on));
        return on;
      })
      .catch(() => {
        cached = false;
        listeners.forEach((l) => l(false));
        return false;
      });
  }
  return pending;
}

export function invalidateChristmasCache(): void {
  cached = null;
  pending = null;
  void load();
}

export function useChristmasMode(): boolean {
  const [on, setOn] = useState<boolean>(cached ?? false);
  useEffect(() => {
    listeners.add(setOn);
    if (cached !== null) setOn(cached);
    else void load();
    return () => {
      listeners.delete(setOn);
    };
  }, []);
  return on;
}
