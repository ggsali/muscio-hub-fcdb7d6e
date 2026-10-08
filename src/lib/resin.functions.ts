import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { parseResinEnabled } from "@/lib/resin-content";

/** Public setting only; never use an admin client for this read. */
export async function readPublicResinEnabled(): Promise<boolean> {
  const url = process.env['SUPABASE_URL'] || import.meta.env.VITE_SUPABASE_URL;
  const key = process.env['SUPABASE_PUBLISHABLE_KEY'] || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return false;
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
      headers.set("apikey", key);
      return fetch(input, { ...init, headers });
    } },
  });
  const { data, error } = await client.from("website_settings").select("value").eq("key", "resin_enabled").maybeSingle();
  return error ? false : parseResinEnabled(data?.value);
}

export const getPublicResinEnabled = createServerFn({ method: "GET" }).handler(readPublicResinEnabled);