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
const PLATE_MAX_BYTES = 45 * 1024 * 1024; // Spardose-Platten (entpackt) dürfen etwas grösser sein
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

/** gzip entpacken mit Grössenbremse (Schutz vor "Zip-Bomben"): wirft, wenn mehr als `max` Bytes herauskommen */
async function gunzipLimited(blob: Blob, max: number): Promise<Uint8Array<ArrayBuffer>> {
  const reader = blob.stream().pipeThrough(new DecompressionStream("gzip")).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > max) { await reader.cancel(); throw new Error("zu gross"); }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Nur POST erlaubt" }, 405);

  const tReq = Date.now(); // Zeitmessung: Beginn der Anfrage in der Edge Function
  const g = globalThis as any;
  g.__sliceInflight ??= 0;
  let counted = false;
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Spardose: ist der G-Code einer Platte schon im Storage? (wird im Hintergrund gespeichert, siehe unten).
    // Nur der zufällige Pfad kalkulator/spardose-<8 Hex>-platte.gcode wird akzeptiert, sonst nichts.
    const gcodeCheck = new URL(req.url).searchParams.get("gcode_check");
    if (gcodeCheck) {
      const m = /^kalkulator\/(spardose-[0-9a-f]{8}-platte\.gcode)$/.exec(gcodeCheck);
      if (!m) return json({ ok: false, error: "ungültiger Pfad" });
      const { data: liste } = await supabase.storage.from("project-uploads").list("kalkulator", { search: m[1], limit: 5 });
      const treffer = (liste ?? []).find((o: { name: string }) => o.name === m[1]) as { metadata?: { size?: number } } | undefined;
      const size = Number(treffer?.metadata?.size ?? 0);
      return json({ ok: true, ready: !!treffer && size > 0, size: size || null });
    }

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
    // Plattenmodus (Spardose-Generator): alle Teile liegen schon fertig angeordnet auf einer Platte -> nur grosser Drucker, ohne Auto-Orient, mit Stützen
    const plate = form.get("plate") === "1";
    const maxBytes = plate ? PLATE_MAX_BYTES : MAX_BYTES;
    let file = form.get("file");
    if (!(file instanceof File)) { await dbg(supabase, { ev: "keine-datei" }); return json({ ok: false, error: "Datei fehlt" }); }
    // Der Browser schickt grosse Dateien verlustfrei gzip-komprimiert (gz=1, Name endet auf .gz): das spart Upload-Zeit.
    const gzBytes = file.size;
    let gzFile: File | null = null; // die komprimierte Originaldatei (wird, wenn der Slicer es kann, komprimiert weitergereicht)
    if (form.get("gz") === "1" && file.name.toLowerCase().endsWith(".gz")) {
      if (gzBytes > maxBytes) return json({ error: "Datei zu gross" }, 413);
      try {
        const original: File = file;
        const raw = await gunzipLimited(original, maxBytes);
        file = new File([raw], original.name.slice(0, -3));
        gzFile = original;
      } catch (_e) {
        return json({ ok: false, error: "Datei konnte nicht entpackt werden" });
      }
    }
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (!ALLOWED_EXT.includes(ext)) return json({ error: "Dateityp nicht erlaubt" }, 422);
    if (file.size > maxBytes) return json({ error: "Datei zu gross" }, 413);
    const upFile: File = file; // (nach dem Entpacken) wird an den Slicer weitergereicht
    const quality = String(form.get("quality") ?? "0.20");
    if (!QUALITIES.includes(quality)) return json({ error: "Ungültige Qualität" }, 422);
    const infill = String(form.get("infill") ?? "").trim();
    if (infill && !/^\d{1,3}$/.test(infill)) return json({ error: "Ungültiger Infill" }, 422);

    // Menge: N Kopien des Teils vom Slicer auf Platten anordnen lassen (nur Kalkulator, nicht Plattenmodus)
    const copiesRaw = parseInt(String(form.get("copies") ?? "1"), 10);
    const copies = !plate && Number.isFinite(copiesRaw) ? Math.min(500, Math.max(1, copiesRaw)) : 1;
    const plateReq = String(form.get("printer") ?? "xl");
    const plateRaw = ["k1c", "a1", "xl"].includes(plateReq) ? plateReq : "xl";
    const buildForm = (printer: string, allowSplit = false, plain = false) => {
      const out = new FormData();
      // allow_split: der Slicer teilt Modelle, die auf keinen Drucker passen, in gleich grosse Stücke (Zuschlag im Kalkulator)
      if (allowSplit) out.append("allow_split", "true");
      // Komprimiert weiterreichen (die Übertragung durch den Tunnel ist der Engpass), solange der Slicer das versteht
      if (gzFile && !plain && g.__serverGz !== false) {
        out.append("gz", "1");
        out.append("file", gzFile, `upload${ext}.gz`);
      } else {
        out.append("file", upFile, `upload${ext}`);
      }
      out.append("printer", printer);
      out.append("material", "pla");
      out.append("quality", quality);
      if (infill) out.append("infill", infill);
      if (copies > 1) out.append("copies", String(copies));
      out.append("supports", "true");
      out.append("orient", plate ? "false" : "true");
      out.append("reference", plate ? "spardose-plate" : "public-calc");
      return out;
    };

    const formMs = Date.now() - tReq; // Einlesen der Anfrage (Upload vom Browser) bis hierher
    await dbg(supabase, { ev: "slice-start", datei: upFile.name, bytes: upFile.size, ...(gzBytes !== upFile.size ? { gzBytes } : {}), quality, infill, formMs });
    g.__sliceInflight++;
    counted = true;
    const t0 = Date.now();
    const slice = async (printer: string, allowSplit = false) => {
      const senden = (plain = false) =>
        fetch(`${base}/slice`, {
          method: "POST",
          headers: { "X-API-Key": key },
          body: buildForm(printer, allowSplit, plain),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      const r = await senden();
      if (!gzFile || g.__serverGz === false) return r;
      if (r.ok) { g.__serverGz = true; return r; }
      // Ein Fehler (4xx) bei komprimierter Übertragung: einmal entpackt wiederholen, ausser das Modell ist schlicht zu gross.
      // Klappt es entpackt, versteht dieser Slicer noch kein gzip -> ab jetzt entpackt senden.
      if (r.status >= 400 && r.status < 500) {
        const txt = JSON.stringify(await r.clone().json().catch(() => ({}))).slice(0, 500);
        if (!txt.includes("model_too_large") && !txt.includes("Unbekannter Drucker") && !txt.includes("Slicen fehlgeschlagen")) {
          const r2 = await senden(true);
          if (r2.ok) {
            g.__serverGz = false;
            await dbg(supabase, { ev: "gz-rueckfall", grund: txt.slice(0, 200) });
          }
          return r2;
        }
      }
      return r;
    };
    // Drucker-Reihenfolge: K1C (klein) -> K1 (falls K1C-Profil fehlt) -> xl (420x420x420 mm, wenn das Teil nicht aufs kleine Bett passt)
    let res!: Response;
    let used = "k1c";
    let letzterZuGross = false;
    const versuche: { p: string; s: number; ms: number }[] = []; // Zeit pro Slicer-Aufruf (jeder lädt die Datei neu hoch)
    // Mehrere Stück: kleine Teile auf A1/K1C, grössere auf K2 Plus/H2C (Profile, die der Slicer nicht kennt, werden übersprungen)
    const druckerFolge = copies > 1 ? ["a1", "k1c", "k2plus", "h2c", "xl"] : ["k1c", "k1", "xl"];
    for (const printer of plate ? [plateRaw] : druckerFolge) {
      const ta = Date.now();
      res = await slice(printer);
      versuche.push({ p: printer, s: res.status, ms: Date.now() - ta });
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
    if (!plate && copies === 1 && res.status === 422 && letzterZuGross) {
      await dbg(supabase, { ev: "teilen", grund: "passt auf keinen Drucker, versuche Teilen" });
      const ta = Date.now();
      res = await slice("xl", true);
      versuche.push({ p: "xl+teilen", s: res.status, ms: Date.now() - ta });
      used = "xl";
    }
    const payload = await res.json().catch(() => ({}));
    const splitRaw = payload?.split ?? payload?.stats?.split ?? null;
    const splitParts = Number(splitRaw?.parts);
    const split = Number.isFinite(splitParts) && splitParts >= 2 ? { parts: Math.min(splitParts, 4) } : null;
    await dbg(supabase, { ev: "nas-antwort", drucker: used, status: res.status, ms: Date.now() - t0, gesamtMs: Date.now() - tReq, versuche, detail: String(payload?.detail ?? payload?.error ?? "").slice(0, 400), stats: payload?.stats ?? null });
    if (!res.ok) return json({ ok: false, error: "Slicer-Fehler", status: res.status, detail: String(payload?.detail ?? "").slice(0, 300) });
    // Plattenmodus: G-Code serverseitig vom NAS holen und im Storage ablegen, damit er der Bestellung angehängt werden kann
    let gcodeError = "";
    if (plate) {
      const jid = String(payload?.job_id ?? "");
      if (!/^[A-Za-z0-9_-]{6,80}$/.test(jid)) {
        gcodeError = "Slicer lieferte keine Job-ID (alte Slicer-Version?)";
      } else {
        const gpath = `kalkulator/spardose-${crypto.randomUUID().slice(0, 8)}-platte.gcode`;
        // G-Code vom Slicer holen und im Storage ablegen. Deno entpackt gzip-Antworten des Slicers automatisch.
        const holeGcode = async (timeoutMs: number): Promise<{ ok: true; size: number } | { ok: false; err: string }> => {
          const tg = Date.now();
          try {
            const gres = await fetch(`${base}/jobs/${jid}/gcode`, { headers: { "X-API-Key": key }, signal: AbortSignal.timeout(timeoutMs) });
            if (!gres.ok) return { ok: false, err: `G-Code-Download vom NAS: HTTP ${gres.status}` };
            const buf = new Uint8Array(await gres.arrayBuffer());
            const tDl = Date.now() - tg;
            let upErr: { message: string } | null = null;
            for (const ct of ["text/plain", "application/octet-stream"]) {
              const r = await supabase.storage.from("project-uploads").upload(gpath, buf, { contentType: ct, upsert: false });
              upErr = r.error as { message: string } | null;
              if (!upErr) break;
            }
            if (upErr) return { ok: false, err: `Speichern fehlgeschlagen: ${String(upErr.message).slice(0, 120)} (${Math.round(buf.byteLength / 1024)} KB)` };
            await dbg(supabase, { ev: "gcode-gespeichert", kb: Math.round(buf.byteLength / 1024), downloadMs: tDl, gesamtMs: Date.now() - tg });
            return { ok: true, size: buf.byteLength };
          } catch (e) {
            return { ok: false, err: `G-Code-Fehler: ${String((e as Error)?.message ?? e).slice(0, 120)}` };
          }
        };
        const edge = g.EdgeRuntime;
        if (typeof edge?.waitUntil === "function") {
          // Preis und Zeit sofort zurückgeben, der G-Code wird im Hintergrund gespeichert (kann bis ca. 100 s dauern).
          // Der Browser prüft vor dem Absenden der Bestellung per ?gcode_check=, ob die Datei schon da ist.
          edge.waitUntil(holeGcode(100_000).then(async (r) => { if (!r.ok) await dbg(supabase, { ev: "gcode-fehler", msg: r.err }); }));
          return json({ ok: true, stats: payload.stats ?? null, gcode_path: gpath, gcode_pending: true });
        }
        const r = await holeGcode(25_000);
        if (r.ok) return json({ ok: true, stats: payload.stats ?? null, gcode_path: gpath, gcode_size: r.size });
        gcodeError = r.err;
      }
      await dbg(supabase, { ev: "gcode-fehler", msg: gcodeError });
    }
    // nur die Zahlen zurückgeben (keine Job-IDs, kein G-Code-Zugriff)
    const platten = Number(payload?.plates ?? payload?.stats?.plates);
    const kopien = Number(payload?.copies ?? payload?.stats?.copies);
    const mengeInfo = copies > 1 && Number.isFinite(platten) && platten >= 1 && kopien === copies
      ? { batch: { copies: kopien, plates: Math.min(500, Math.floor(platten)), printer: used } }
      : {};
    return json({ ok: true, stats: payload.stats ?? null, ...(split ? { split } : {}), ...mengeInfo, ...(gcodeError ? { gcode_error: gcodeError } : {}) });
  } catch (e) {
    console.error("slice-public error:", e);
    try { await dbg(createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!), { ev: "fehler", msg: String((e as Error)?.message ?? e).slice(0, 300) }); } catch { /* ignore */ }
    return json({ ok: false, error: "Slicer nicht erreichbar" });
  } finally {
    if (counted) g.__sliceInflight = Math.max(0, g.__sliceInflight - 1);
  }
});
