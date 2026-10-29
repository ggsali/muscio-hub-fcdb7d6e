import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Eingang für den Barcode-Scanner am Server.
// - Stempel-Code (Setting "stempel_code"): schaltet die Arbeitszeit ein/aus.
// - Jeder andere Code: wird als Scan-Ereignis abgelegt, das offene Admin-Seiten per Realtime empfangen.
// Auth: Header x-api-key = Secret SCAN_API_KEY (kein Benutzer-Login, der Server ruft diese Funktion auf).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-api-key, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function gleich(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Nur POST erlaubt" }, 405);
  try {
    const erwartet = Deno.env.get("SCAN_API_KEY") || "";
    if (!erwartet) return json({ error: "SCAN_API_KEY ist nicht als Secret gesetzt" }, 500);
    const key = req.headers.get("x-api-key") || "";
    if (!gleich(key, erwartet)) return json({ error: "Nicht berechtigt" }, 401);

    const body = await req.json().catch(() => ({}));
    const code = String(body?.code ?? "").trim();
    if (!code || code.length > 200) return json({ error: "Ungültiger Code" }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: setting } = await supabase.from("settings").select("value").eq("key", "stempel_code").maybeSingle();
    const stempelCode = (setting as any)?.value as string | undefined;

    if (stempelCode && gleich(code, stempelCode)) {
      const { data: letzte } = await supabase
        .from("arbeitszeit").select("id, start_at, ende_at").order("start_at", { ascending: false }).limit(1).maybeSingle();
      const jetzt = new Date();
      const letzteAktion = letzte ? new Date((letzte as any).ende_at ?? (letzte as any).start_at) : null;
      // Doppelscan innerhalb von 5 Sekunden ignorieren
      if (letzteAktion && jetzt.getTime() - letzteAktion.getTime() < 5000) return json({ aktion: "ignoriert" });

      if (letzte && !(letzte as any).ende_at) {
        const { error } = await supabase.from("arbeitszeit").update({ ende_at: jetzt.toISOString() }).eq("id", (letzte as any).id);
        if (error) throw error;
        const min = Math.round((jetzt.getTime() - new Date((letzte as any).start_at).getTime()) / 60000);
        return json({ aktion: "ausgestempelt", minuten: min });
      }
      const { error } = await supabase.from("arbeitszeit").insert({ start_at: jetzt.toISOString() });
      if (error) throw error;
      return json({ aktion: "eingestempelt" });
    }

    // Anderer Code: an die Admin-Seiten weiterreichen, alte Ereignisse aufräumen
    const { error } = await supabase.from("scan_events").insert({ code, quelle: "server" });
    if (error) throw error;
    await supabase.from("scan_events").delete().lt("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString());
    return json({ aktion: "weitergeleitet" });
  } catch (e: any) {
    return json({ error: e?.message ?? "Fehler" }, 500);
  }
});
