import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Öffentliche Slice-Schätzung für den Online-Kalkulator: leitet das Modell an den NAS-Slicer weiter.
// Nur aktiv, wenn settings.public_nas_slice_enabled = 'true'. Sonst 503 -> der Kalkulator nutzt den Browser-Slicer.
// Kein Einreihen, kein Drucker, nur Zahlen (Zeit, Gramm, Layer, Support). Secrets: SLICER_URL, SLICER_API_KEY.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const MAX_BYTES = 30 * 1024 * 1024;
const TIMEOUT_MS = 100_000;
const ALLOWED_EXT = [".stl", ".obj", ".3mf"];
const QUALITIES = ["0.08", "0.12", "0.16", "0.20"];
const RATE_WINDOW_MS = 10 * 60_000;
const RATE_MAX = 12; // Slices pro IP und 10 Minuten
const MAX_PARALLEL = 3; // gleichzeitige Slices insgesamt (NAS schonen)

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Nur POST erlaubt" }, 405);

  const g = globalThis as any;
  g.__sliceInflight ??= 0;
  let counted = false;
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: flag } = await supabase.from("settings").select("value").eq("key", "public_nas_slice_enabled").maybeSingle();
    if (flag?.value !== "true") return json({ error: "deaktiviert" }, 503);

    const base = (Deno.env.get("SLICER_URL") || "").replace(/\/+$/, "");
    const key = Deno.env.get("SLICER_API_KEY") || "";
    if (!base || !key) return json({ error: "nicht konfiguriert" }, 503);

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
    const now = Date.now();
    const store: Map<string, number[]> = (g.__sliceRate ||= new Map());
    const hits = (store.get(ip) || []).filter((t: number) => now - t < RATE_WINDOW_MS);
    if (hits.length >= RATE_MAX) return json({ error: "Zu viele Anfragen" }, 429);
    if (g.__sliceInflight >= MAX_PARALLEL) return json({ error: "ausgelastet" }, 503);
    hits.push(now);
    store.set(ip, hits);

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return json({ error: "Datei fehlt" }, 400);
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (!ALLOWED_EXT.includes(ext)) return json({ error: "Dateityp nicht erlaubt" }, 422);
    if (file.size > MAX_BYTES) return json({ error: "Datei zu gross" }, 413);
    const quality = String(form.get("quality") ?? "0.20");
    if (!QUALITIES.includes(quality)) return json({ error: "Ungültige Qualität" }, 422);
    const infill = String(form.get("infill") ?? "").trim();
    if (infill && !/^\d{1,3}$/.test(infill)) return json({ error: "Ungültiger Infill" }, 422);

    const out = new FormData();
    out.append("file", file, `upload${ext}`);
    out.append("printer", "k1c");
    out.append("material", "pla");
    out.append("quality", quality);
    if (infill) out.append("infill", infill);
    out.append("supports", "true");
    out.append("orient", "true");
    out.append("reference", "public-calc");

    g.__sliceInflight++;
    counted = true;
    const res = await fetch(`${base}/slice`, {
      method: "POST",
      headers: { "X-API-Key": key },
      body: out,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) return json({ error: "Slicer-Fehler", status: res.status }, 502);
    // nur die Zahlen zurückgeben (keine Job-IDs, kein G-Code-Zugriff)
    return json({ stats: payload.stats ?? null });
  } catch (e) {
    console.error("slice-public error:", e);
    return json({ error: "Slicer nicht erreichbar" }, 504);
  } finally {
    if (counted) g.__sliceInflight = Math.max(0, g.__sliceInflight - 1);
  }
});
