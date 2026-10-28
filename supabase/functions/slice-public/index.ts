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
const TIMEOUT_MS = 120_000;
const ALLOWED_EXT = [".stl", ".obj", ".3mf"];
const QUALITIES = ["0.08", "0.12", "0.16", "0.20"];
const RATE_WINDOW_MS = 10 * 60_000;
const RATE_MAX = 12; // Slices pro IP und 10 Minuten
const MAX_PARALLEL = 3; // gleichzeitige Slices insgesamt (NAS schonen)

// Fehler werden bewusst mit HTTP 200 und ok:false beantwortet: der Kalkulator fällt dann still auf den Browser-Slicer zurück.
const json = (body: unknown, _status = 200) =>
  new Response(JSON.stringify(body), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Debug-Protokoll: letzte 40 Ereignisse in settings.slice_debug_log (im Admin unter Slice-Freigabe sichtbar)
async function dbg(supabase: any, entry: Record<string, unknown>) {
  try {
    const { data } = await supabase.from("settings").select("value").eq("key", "slice_debug_log").maybeSingle();
    let arr: unknown[] = [];
    try { arr = JSON.parse(data?.value ?? "[]"); } catch { arr = []; }
    arr.push({ t: new Date().toISOString(), ...entry });
    await supabase.from("settings").upsert({ key: "slice_debug_log", value: JSON.stringify(arr.slice(-40)) }, { onConflict: "key" });
  } catch (e) { console.error("dbg failed", e); }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Nur POST erlaubt" }, 405);

  const g = globalThis as any;
  g.__sliceInflight ??= 0;
  let counted = false;
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: flag } = await supabase.from("settings").select("value").eq("key", "public_nas_slice_enabled").maybeSingle();
    if (flag?.value !== "true") { await dbg(supabase, { ev: "aus", flag: flag?.value ?? null }); return json({ ok: false, enabled: false, error: "deaktiviert" }); }

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
    if (form.get("log") === "1") {
      await dbg(supabase, { ev: "client", msg: String(form.get("msg") ?? "").slice(0, 400) });
      return json({ ok: true });
    }
    if (form.get("probe") === "1") {
      await dbg(supabase, { ev: "probe" });
      const { data: only } = await supabase.from("settings").select("value").eq("key", "public_nas_only").maybeSingle();
      return json({ ok: true, enabled: true, nasOnly: only?.value === "true" });
    }
    const file = form.get("file");
    if (!(file instanceof File)) { await dbg(supabase, { ev: "keine-datei" }); return json({ ok: false, error: "Datei fehlt" }); }
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (!ALLOWED_EXT.includes(ext)) return json({ error: "Dateityp nicht erlaubt" }, 422);
    if (file.size > MAX_BYTES) return json({ error: "Datei zu gross" }, 413);
    const quality = String(form.get("quality") ?? "0.20");
    if (!QUALITIES.includes(quality)) return json({ error: "Ungültige Qualität" }, 422);
    const infill = String(form.get("infill") ?? "").trim();
    if (infill && !/^\d{1,3}$/.test(infill)) return json({ error: "Ungültiger Infill" }, 422);

    // Plattenmodus (Spardose-Generator): alle Teile liegen schon fertig angeordnet auf einer Platte -> nur grosser Drucker, ohne Auto-Orient, mit Stützen
    const plate = form.get("plate") === "1";
    const plateReq = String(form.get("printer") ?? "xl");
    const plateRaw = ["k1c", "a1", "xl"].includes(plateReq) ? plateReq : "xl";
    const buildForm = (printer: string, allowSplit = false) => {
      const out = new FormData();
      // allow_split: der Slicer teilt Modelle, die auf keinen Drucker passen, in gleich grosse Stücke (Zuschlag im Kalkulator)
      if (allowSplit) out.append("allow_split", "true");
      out.append("file", file, `upload${ext}`);
      out.append("printer", printer);
      out.append("material", "pla");
      out.append("quality", quality);
      if (infill) out.append("infill", infill);
      out.append("supports", "true");
      out.append("orient", plate ? "false" : "true");
      out.append("reference", plate ? "spardose-plate" : "public-calc");
      return out;
    };

    await dbg(supabase, { ev: "slice-start", datei: file.name, bytes: file.size, quality, infill });
    g.__sliceInflight++;
    counted = true;
    const t0 = Date.now();
    const slice = (printer: string, allowSplit = false) =>
      fetch(`${base}/slice`, {
        method: "POST",
        headers: { "X-API-Key": key },
        body: buildForm(printer, allowSplit),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    // Drucker-Reihenfolge: K1C (klein) -> K1 (falls K1C-Profil fehlt) -> xl (420x420x420 mm, wenn das Teil nicht aufs kleine Bett passt)
    let res!: Response;
    let used = "k1c";
    let letzterZuGross = false;
    for (const printer of plate ? [plateRaw] : ["k1c", "k1", "xl"]) {
      res = await slice(printer);
      used = printer;
      letzterZuGross = false;
      if (res.status !== 422) break;
      const peek = await res.clone().json().catch(() => ({}));
      const d = String(peek?.detail ?? "");
      // "model_too_large" = Bauraum-Vorprüfung des Slicers (Modell passt nicht aufs Bett) -> nächsten, grösseren Drucker versuchen
      const zuGross = peek?.error === "model_too_large" || peek?.detail?.error === "model_too_large";
      letzterZuGross = zuGross;
      if (!zuGross && !d.includes("Unbekannter Drucker") && !d.includes("Slicen fehlgeschlagen")) break;
      await dbg(supabase, { ev: "drucker-wechsel", von: printer, grund: zuGross ? "zu gross fuers Bett" : d.slice(0, 200) });
    }
    // Passt das Modell auf keinen Drucker: auf dem grössten (xl) mit automatischem Teilen erneut versuchen.
    // Ältere Slicer ignorieren allow_split und antworten wieder mit 422 -> Verhalten wie bisher (Rückfall im Kalkulator).
    if (!plate && res.status === 422 && letzterZuGross) {
      await dbg(supabase, { ev: "teilen", grund: "passt auf keinen Drucker, versuche Teilen" });
      res = await slice("xl", true);
      used = "xl";
    }
    const payload = await res.json().catch(() => ({}));
    const splitRaw = payload?.split ?? payload?.stats?.split ?? null;
    const splitParts = Number(splitRaw?.parts);
    const split = Number.isFinite(splitParts) && splitParts >= 2 ? { parts: Math.min(splitParts, 4) } : null;
    await dbg(supabase, { ev: "nas-antwort", drucker: used, status: res.status, ms: Date.now() - t0, detail: String(payload?.detail ?? payload?.error ?? "").slice(0, 400), stats: payload?.stats ?? null });
    if (!res.ok) return json({ ok: false, error: "Slicer-Fehler", status: res.status, detail: String(payload?.detail ?? "").slice(0, 300) });
    // Plattenmodus: G-Code serverseitig vom NAS holen und im Storage ablegen, damit er der Bestellung angehängt werden kann
    let gcodeError = "";
    if (plate) {
      const jid = String(payload?.job_id ?? "");
      if (!/^[A-Za-z0-9_-]{6,80}$/.test(jid)) {
        gcodeError = "Slicer lieferte keine Job-ID (alte Slicer-Version?)";
      } else {
        try {
          const gres = await fetch(`${base}/jobs/${jid}/gcode`, { headers: { "X-API-Key": key }, signal: AbortSignal.timeout(25_000) });
          if (!gres.ok) {
            gcodeError = `G-Code-Download vom NAS: HTTP ${gres.status}`;
          } else {
            const buf = new Uint8Array(await gres.arrayBuffer());
            const gpath = `kalkulator/spardose-${crypto.randomUUID().slice(0, 8)}-platte.gcode`;
            let upErr: { message: string } | null = null;
            for (const ct of ["text/plain", "application/octet-stream"]) {
              const r = await supabase.storage.from("project-uploads").upload(gpath, buf, { contentType: ct, upsert: false });
              upErr = r.error as { message: string } | null;
              if (!upErr) break;
            }
            if (!upErr) return json({ ok: true, stats: payload.stats ?? null, gcode_path: gpath, gcode_size: buf.byteLength });
            gcodeError = `Speichern fehlgeschlagen: ${String(upErr.message).slice(0, 120)} (${Math.round(buf.byteLength / 1024)} KB)`;
          }
        } catch (e) {
          gcodeError = `G-Code-Fehler: ${String((e as Error)?.message ?? e).slice(0, 120)}`;
        }
      }
      await dbg(supabase, { ev: "gcode-fehler", msg: gcodeError });
    }
    // nur die Zahlen zurückgeben (keine Job-IDs, kein G-Code-Zugriff)
    return json({ ok: true, stats: payload.stats ?? null, ...(split ? { split } : {}), ...(gcodeError ? { gcode_error: gcodeError } : {}) });
  } catch (e) {
    console.error("slice-public error:", e);
    try { await dbg(createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!), { ev: "fehler", msg: String((e as Error)?.message ?? e).slice(0, 300) }); } catch { /* ignore */ }
    return json({ ok: false, error: "Slicer nicht erreichbar" });
  } finally {
    if (counted) g.__sliceInflight = Math.max(0, g.__sliceInflight - 1);
  }
});
