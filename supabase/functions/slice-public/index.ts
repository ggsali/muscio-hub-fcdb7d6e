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
const GROSS_GZ_MAX = 120 * 1024 * 1024; // sehr grosse Modelle (nur ueber den Storage): komprimiert bis hierhin, ohne in der Funktion zu entpacken
const ALLOWED_EXT = [".stl", ".obj", ".3mf"];
const QUALITIES = ["0.08", "0.12", "0.16", "0.20"];
const RATE_WINDOW_MS = 10 * 60_000;
const RATE_MAX = 30; // echte Slices pro IP und 10 Minuten (Probe und Log zaehlen nicht mit)
const MAX_PARALLEL = 3; // gleichzeitige Slices insgesamt (NAS schonen)

// Fehler werden bewusst mit HTTP 200 und ok:false beantwortet: der Kalkulator fällt dann still auf den Browser-Slicer zurück.
const json = (body: unknown, _status = 200) =>
  new Response(JSON.stringify(body), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Debug-Protokoll: letzte 120 Ereignisse in settings.slice_debug_log (im Admin unter Slice-Freigabe sichtbar)
async function dbg(supabase: any, entry: Record<string, unknown>) {
  try {
    const { data } = await supabase.from("settings").select("value").eq("key", "slice_debug_log").maybeSingle();
    let arr: unknown[] = [];
    try { arr = JSON.parse(data?.value ?? "[]"); } catch { arr = []; }
    arr.push({ t: new Date().toISOString(), ...entry });
    await supabase.from("settings").upsert({ key: "slice_debug_log", value: JSON.stringify(arr.slice(-120)) }, { onConflict: "key" });
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

// Messwerte, die der Browser zu jedem Slice meldet (nur feste Felder, Texte gekuerzt): settings.slice_client_log, letzte 80 Eintraege
const DIAG_TEXT = ["rid", "file", "ct", "err", "body", "abort", "phase", "net", "via"] as const;
const DIAG_NUM = ["sizeB", "gzB", "gzMs", "upMs", "totalMs", "status", "q", "infill", "copies", "tri", "parts"] as const;
async function speichereDiag(supabase: any, raw: unknown) {
  let d: Record<string, unknown> = {};
  try { d = typeof raw === "string" ? JSON.parse(raw) : {}; } catch { return; }
  const out: Record<string, unknown> = { t: new Date().toISOString() };
  for (const k of DIAG_TEXT) if (typeof d[k] === "string") out[k] = String(d[k]).replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, k === "body" || k === "err" ? 200 : 60);
  for (const k of DIAG_NUM) if (Number.isFinite(Number(d[k])) && d[k] !== null && d[k] !== "") out[k] = Math.round(Number(d[k]) * 100) / 100;
  if (typeof d.ok === "boolean") out.ok = d.ok;
  const { data } = await supabase.from("settings").select("value").eq("key", "slice_client_log").maybeSingle();
  let arr: unknown[] = [];
  try { arr = JSON.parse(data?.value ?? "[]"); } catch { arr = []; }
  arr.push(out);
  await supabase.from("settings").upsert({ key: "slice_client_log", value: JSON.stringify(arr.slice(-80)) }, { onConflict: "key" });
}

// Kann der Slicer eine Datei selbst von einer Download-Adresse holen (file_url)? Meldet er in /health unter "features". 5 Minuten gemerkt.
async function slicerKannUrl(base: string, key: string): Promise<boolean> {
  const g = globalThis as any;
  if (g.__urlCap && Date.now() - g.__urlCap.at < 5 * 60_000) return g.__urlCap.ok;
  let ok = false;
  try {
    const r = await fetch(`${base}/health`, { headers: { "X-API-Key": key }, signal: AbortSignal.timeout(4000) });
    const j = await r.json().catch(() => ({}));
    ok = Array.isArray(j?.features) && j.features.includes("file_url");
  } catch { ok = false; }
  g.__urlCap = { at: Date.now(), ok };
  return ok;
}

// Aufraeumen: Uploads fuer grosse Slices (kalkulator/slice-...) sind nach dem Abholen weg. Reste (abgebrochene Aufrufe) loeschen wir nach 1 Stunde.
async function raeumeAuf(supabase: any) {
  const g = globalThis as any;
  if (Date.now() - (g.__sliceCleanupAt ?? 0) < 10 * 60_000) return;
  g.__sliceCleanupAt = Date.now();
  try {
    const { data } = await supabase.storage.from("project-uploads").list("kalkulator", { search: "slice-", limit: 200 });
    const alt = (data ?? []).filter((o: { name: string; created_at?: string }) => o.name.startsWith("slice-") && o.created_at && Date.now() - new Date(o.created_at).getTime() > 60 * 60_000);
    if (alt.length) await supabase.storage.from("project-uploads").remove(alt.map((o: { name: string }) => `kalkulator/${o.name}`));
  } catch (e) { console.error("aufraeumen fehlgeschlagen", e); }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Nur POST erlaubt" }, 405);

  const tReq = Date.now(); // Zeitmessung: Beginn der Anfrage in der Edge Function
  const g = globalThis as any;
  g.__sliceInflight ??= 0;
  let counted = false;
  let aufraeumen = ""; // Storage-Pfad, der nach dem Slice geloescht wird (Slicer hat die Datei selbst geholt)
  let rid = ""; // Kennung, die der Browser mitschickt: verbindet Browser-Messung und Server-Ereignisse
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
    // Standard: an. Nur wenn der Schalter ausdruecklich auf "false" steht, ist der Server-Slicer aus.
    if (flag?.value === "false") { await dbg(supabase, { ev: "aus", flag: flag?.value ?? null }); return json({ ok: false, enabled: false, error: "deaktiviert" }); }

    const base = (Deno.env.get("SLICER_URL") || "").replace(/\/+$/, "");
    const key = Deno.env.get("SLICER_API_KEY") || "";
    if (!base || !key) return json({ error: "nicht konfiguriert" }, 503);

    // Probe und Log (?mode=probe|log) verbrauchen kein Kontingent: sonst war die Grenze nach wenigen Teilen und Qualitaetswechseln
    // aufgebraucht und neue Teile (z. B. in der Uebersicht) wurden nicht mehr ueber den Server gerechnet.
    const mode = new URL(req.url).searchParams.get("mode");
    const leicht = mode === "probe" || mode === "log" || mode === "diag";
    if (!leicht) {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
      const now = Date.now();
      const store: Map<string, number[]> = (g.__sliceRate ||= new Map());
      const hits = (store.get(ip) || []).filter((t: number) => now - t < RATE_WINDOW_MS);
      if (hits.length >= RATE_MAX) return json({ error: "Zu viele Anfragen" }, 429);
      if (g.__sliceInflight >= MAX_PARALLEL) return json({ error: "ausgelastet" }, 503);
      hits.push(now);
      store.set(ip, hits);
    }

    void raeumeAuf(supabase);
    const form = await req.formData();
    if (form.get("diag") === "1") {
      await speichereDiag(supabase, form.get("d"));
      return json({ ok: true });
    }
    rid = String(form.get("rid") ?? "").replace(/[^\w-]/g, "").slice(0, 24);
    if (form.get("log") === "1") {
      // Browser-Meldungen landen nur noch im Server-Log, nicht im Admin-Protokoll:
      // so kann niemand von aussen Texte ins Slice-Freigabe-Protokoll schreiben.
      console.log("slice-public client-log", String(form.get("msg") ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 400));
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
    // Grosse Dateien kommen nicht durch die Anfrage, sondern liegen schon im Storage (kalkulator/slice-...): hier abholen und danach loeschen
    let viaStorage = false;
    const sp = String(form.get("storage_path") ?? "");
    let urlMode = ""; // Adresse, von der der Slicer die Datei selbst holt (schnell: NAS <-> Storage direkt, ohne Umweg ueber die Funktion)
    let urlSize = 0;
    if (!(file instanceof File) && /^kalkulator\/slice-[A-Za-z0-9]{6,16}-[A-Za-z0-9._-]{1,100}$/.test(sp) && await slicerKannUrl(base, key)) {
      const name = sp.split("/").pop() as string;
      const { data: lst } = await supabase.storage.from("project-uploads").list("kalkulator", { search: name, limit: 5 });
      const meta = (lst ?? []).find((o: { name: string }) => o.name === name) as { metadata?: { size?: number } } | undefined;
      const size = Number(meta?.metadata?.size ?? 0);
      const { data: su } = await supabase.storage.from("project-uploads").createSignedUrl(sp, 900);
      if (size > 0 && su?.signedUrl) {
        urlMode = su.signedUrl; urlSize = size; file = new File([], name); viaStorage = true; aufraeumen = sp;
        await dbg(supabase, { rid, ev: "storage-url", bytes: size });
      }
    }
    if (!urlMode && !(file instanceof File) && /^kalkulator\/slice-[A-Za-z0-9]{6,16}-[A-Za-z0-9._-]{1,100}$/.test(sp)) {
      const tD = Date.now();
      const { data: blob, error: dlErr } = await supabase.storage.from("project-uploads").download(sp);
      if (dlErr || !blob) { await dbg(supabase, { rid, ev: "storage-fehlt", pfad: sp, grund: String(dlErr?.message ?? "leer").slice(0, 100) }); return json({ ok: false, error: "Upload nicht gefunden" }); }
      file = new File([blob], sp.split("/").pop() as string);
      viaStorage = true;
      void supabase.storage.from("project-uploads").remove([sp]);
      await dbg(supabase, { rid, ev: "storage-geholt", bytes: blob.size, ms: Date.now() - tD });
    }
    if (!(file instanceof File)) { await dbg(supabase, { rid, ev: "keine-datei", ct: String(req.headers.get("content-type") ?? "").slice(0, 60), cl: req.headers.get("content-length"), felder: [...form.keys()].join(",").slice(0, 80), typ: typeof file }); return json({ ok: false, error: "Datei fehlt" }); }
    // Der Browser schickt grosse Dateien verlustfrei gzip-komprimiert (gz=1, Name endet auf .gz): das spart Upload-Zeit.
    const gzBytes = urlMode ? urlSize : file.size;
    let gzFile: File | null = null; // die komprimierte Originaldatei (wird, wenn der Slicer es kann, komprimiert weitergereicht)
    let grossGz = false; // sehr grosses Modell: nur komprimiert an den Slicer weiterreichen, hier nicht entpacken (Speicher der Funktion)
    if ((form.get("gz") === "1" || viaStorage) && file.name.toLowerCase().endsWith(".gz")) {
      if (urlMode) {
        if (gzBytes > GROSS_GZ_MAX) { await dbg(supabase, { rid, ev: "zu-gross", gzBytes, gzMax: GROSS_GZ_MAX }); return json({ error: "Datei zu gross" }, 413); }
        grossGz = true; // der Slicer entpackt selbst
        gzFile = file;
      } else if (gzBytes > maxBytes) {
        if (viaStorage && !plate && gzBytes <= GROSS_GZ_MAX && g.__serverGz !== false) {
          grossGz = true;
          gzFile = file;
          await dbg(supabase, { rid, ev: "gross-komprimiert-weiter", gzBytes });
        } else {
          await dbg(supabase, { rid, ev: "zu-gross", gzBytes, max: maxBytes, gzMax: GROSS_GZ_MAX, serverGz: g.__serverGz ?? null });
          return json({ error: "Datei zu gross" }, 413);
        }
      }
      if (!grossGz) try {
        const original: File = file;
        const raw = await gunzipLimited(original, maxBytes);
        file = new File([raw], original.name.slice(0, -3));
        gzFile = original;
      } catch (_e) {
        await dbg(supabase, { rid, ev: "entpacken-fehlgeschlagen", gzBytes, max: maxBytes, grund: String((_e as Error)?.message ?? _e).slice(0, 100) });
        return json({ ok: false, error: "Datei konnte nicht entpackt werden" });
      }
    }
    const nameOhneGz = grossGz ? file.name.slice(0, -3) : file.name;
    const ext = nameOhneGz.toLowerCase().slice(nameOhneGz.lastIndexOf("."));
    if (!ALLOWED_EXT.includes(ext)) { await dbg(supabase, { rid, ev: "dateityp", ext }); return json({ error: "Dateityp nicht erlaubt" }, 422); }
    if (urlMode && urlSize > GROSS_GZ_MAX) { await dbg(supabase, { rid, ev: "zu-gross", bytes: urlSize, gzMax: GROSS_GZ_MAX }); return json({ error: "Datei zu gross" }, 413); }
    if (!grossGz && !urlMode && file.size > maxBytes) { await dbg(supabase, { rid, ev: "zu-gross", bytes: file.size, max: maxBytes }); return json({ error: "Datei zu gross" }, 413); }
    const upFile: File = file; // (nach dem Entpacken) wird an den Slicer weitergereicht
    const quality = String(form.get("quality") ?? "0.20");
    if (!QUALITIES.includes(quality)) return json({ error: "Ungültige Qualität" }, 422);
    const profile = String(form.get("profile") ?? "").trim();
    if (profile && !/^[\w .@()+\-]{1,80}$/.test(profile)) return json({ error: "Ungültiges Profil" }, 422);
    let profileAktiv = profile; // wird geleert, falls das Preset für einen Drucker nicht existiert (dann Standardprofil nach Schichthöhe)
    const infill = String(form.get("infill") ?? "").trim();
    if (infill && !/^\d{1,3}$/.test(infill)) return json({ error: "Ungültiger Infill" }, 422);

    // Menge: N Kopien des Teils vom Slicer auf Platten anordnen lassen (nur Kalkulator, nicht Plattenmodus)
    const copiesRaw = parseInt(String(form.get("copies") ?? "1"), 10);
    const copies = !plate && Number.isFinite(copiesRaw) ? Math.min(500, Math.max(1, copiesRaw)) : 1;
    const plateReq = String(form.get("printer") ?? "xl");
    const plateRaw = ["k1c", "a1", "xl"].includes(plateReq) ? plateReq : "xl";
    const buildForm = (printer: string, allowSplit = false, plain = false, kopien = copies) => {
      const out = new FormData();
      // allow_split: der Slicer teilt Modelle, die auf keinen Drucker passen, in gleich grosse Stücke (Zuschlag im Kalkulator)
      if (allowSplit) out.append("allow_split", "true");
      // Komprimiert weiterreichen (die Übertragung durch den Tunnel ist der Engpass), solange der Slicer das versteht
      if (urlMode) {
        out.append("file_url", urlMode);
        if (grossGz) out.append("gz", "1");
      } else if (gzFile && !plain && g.__serverGz !== false) {
        out.append("gz", "1");
        out.append("file", gzFile, `upload${ext}.gz`);
      } else {
        out.append("file", upFile, `upload${ext}`);
      }
      out.append("printer", printer);
      out.append("material", "pla");
      out.append("quality", quality);
      if (infill) out.append("infill", infill);
      if (profileAktiv) out.append("profile", profileAktiv);
      if (kopien > 1) out.append("copies", String(kopien));
      out.append("supports", "true");
      out.append("orient", plate ? "false" : "true");
      out.append("reference", plate ? "spardose-plate" : "public-calc");
      return out;
    };

    const formMs = Date.now() - tReq; // Einlesen der Anfrage (Upload vom Browser) bis hierher
    await dbg(supabase, { rid, rss: Math.round((Deno.memoryUsage?.().rss ?? 0) / 1048576), ev: "slice-start", datei: upFile.name.replace(/[^\w.\- ()äöüÄÖÜ]/g, "_").slice(0, 80), bytes: urlMode ? urlSize : upFile.size, ...(urlMode ? { via: "slicer-holt-selbst" } : {}), ...(gzBytes !== upFile.size ? { gzBytes } : {}), quality, infill, formMs });
    g.__sliceInflight++;
    counted = true;
    const t0 = Date.now();
    const slice = async (printer: string, allowSplit = false, kopien = copies) => {
      const senden = (plain = false) =>
        fetch(`${base}/slice`, {
          method: "POST",
          headers: { "X-API-Key": key },
          body: buildForm(printer, allowSplit, plain, kopien),
          signal: AbortSignal.timeout(grossGz ? 140_000 : TIMEOUT_MS), // sehr grosse Modelle: Uebertragung ca. 35-60 s + Slicen ca. 60 s
        });
      const r = await senden();
      if (!gzFile || g.__serverGz === false || grossGz || urlMode) return r;
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
    // Drucker-Reihenfolge: K1C (klein) -> K1 (falls K1C-Profil fehlt) -> K2 Plus (350 mm, wenn das Teil nicht aufs kleine Bett passt)
    let res!: Response;
    let used = "k1c";
    let letzterZuGross = false;
    const versuche: { p: string; s: number; ms: number }[] = []; // Zeit pro Slicer-Aufruf (jeder lädt die Datei neu hoch)
    // Mehrere Stück: kleine Teile auf A1/K1C, grössere auf K2 Plus/H2C (Profile, die der Slicer nicht kennt, werden übersprungen)
    let druckerFolge = copies > 1 ? ["a1", "k1c", "k2plus", "h2c"] : ["k1c", "k1", "k2plus"];
    // Verfügbarkeit (SimplyPrint, über den Slicer-Dienst): frühester freier Drucker zuerst, offline/unbekannte danach.
    // Das ist nur eine Sortierung: ist nichts frei oder der Status nicht erreichbar, wird trotzdem gesliced (nie ein Fehler wegen Auslastung).
    if (!plate) {
      try {
        const sr = await fetch(`${base}/printers/status`, { headers: { "X-API-Key": key }, signal: AbortSignal.timeout(4000) });
        if (sr.ok) {
          const st: any = await sr.json();
          const wait = new Map<string, number>();
          for (const pr of Array.isArray(st?.printers) ? st.printers : []) {
            const id = String(pr?.id ?? "");
            if (!druckerFolge.includes(id) || ["offline", "error"].includes(String(pr?.state ?? ""))) continue;
            const w = Number(pr?.free_in_min);
            wait.set(id, Number.isFinite(w) && w >= 0 ? w : String(pr?.state) === "idle" ? 0 : 9999);
          }
          if (wait.size > 0) {
            const frei = druckerFolge.filter((x) => wait.has(x)).sort((a, b) => (wait.get(a)! - wait.get(b)!) || (druckerFolge.indexOf(a) - druckerFolge.indexOf(b)));
            druckerFolge = [...frei, ...druckerFolge.filter((x) => !wait.has(x))];
            await dbg(supabase, { rid, ev: "drucker-status", folge: druckerFolge.join(","), wartezeit: Object.fromEntries(wait) });
          }
        }
      } catch { /* ohne Status: feste Reihenfolge */ }
    }
    for (const printer of plate ? [plateRaw] : druckerFolge) {
      const ta = Date.now();
      res = await slice(printer);
      if (res.status === 422 && profileAktiv) {
        const pk = await res.clone().json().catch(() => ({}));
        if (String(pk?.detail ?? "").includes("Profil")) {
          await dbg(supabase, { rid, ev: "profil-unbekannt", drucker: printer, profil: profileAktiv, antwort: String(pk?.detail ?? "").slice(0, 200) });
          profileAktiv = "";
          res = await slice(printer);
        }
      }
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
      await dbg(supabase, { rid, ev: "drucker-wechsel", von: printer, grund: zuGross ? "zu gross fuers Bett" : d.slice(0, 200) });
    }
    // Mehrere Stück: braucht der kleine Drucker mehrere Platten, auch den K2 Plus (grösseres Bett) probieren und die Variante
    // mit weniger Platten nehmen (jede Platte = eine Druckerbestückung = eine Setup-Pauschale). Bei Gleichstand der kleinere Drucker.
    if (copies > 1 && !plate && res.ok && used !== "k2plus") {
      const p1 = await res.clone().json().catch(() => ({}));
      const n1 = Number(p1?.plates);
      if (Number.isFinite(n1) && n1 > 1) {
        const ta = Date.now();
        const alt = await slice("k2plus");
        versuche.push({ p: "k2plus-vergleich", s: alt.status, ms: Date.now() - ta });
        if (alt.ok) {
          const p2 = await alt.clone().json().catch(() => ({}));
          const n2 = Number(p2?.plates);
          if (Number.isFinite(n2) && n2 >= 1 && n2 < n1) { res = alt; used = "k2plus"; }
        }
      }
    }
    // Passt das Modell auf keinen Drucker: auf dem grössten (K2 Plus) mit automatischem Teilen erneut versuchen.
    // Ältere Slicer ignorieren allow_split und antworten wieder mit 422 -> Verhalten wie bisher (Rückfall im Kalkulator).
    // Mehrere Stück eines Teils, das auf keinen Drucker passt: ein Stück (geteilt) auf dem grössten Drucker slicen, Menge selbst hochrechnen.
    // Jedes geteilte Stück belegt eine eigene Platte (die Teile eines Stücks passen zusammen auf eine Platte, sonst meldet der Slicer einen Fehler).
    let teilenMenge = false;
    if (!plate && copies > 1 && res.status === 422 && letzterZuGross) {
      await dbg(supabase, { ev: "teilen", grund: `Menge ${copies}: passt auf keinen Drucker, ein Stück geteilt slicen` });
      const ta = Date.now();
      res = await slice("k2plus", true, 1);
      versuche.push({ p: "k2plus+teilen(1)", s: res.status, ms: Date.now() - ta });
      used = "k2plus";
      teilenMenge = res.ok;
    }
    if (!plate && copies === 1 && res.status === 422 && letzterZuGross) {
      await dbg(supabase, { ev: "teilen", grund: "passt auf keinen Drucker, versuche Teilen" });
      const ta = Date.now();
      res = await slice("k2plus", true);
      versuche.push({ p: "k2plus+teilen", s: res.status, ms: Date.now() - ta });
      used = "k2plus";
    }
    const payload = await res.json().catch(() => ({}));
    const splitRaw = payload?.split ?? payload?.stats?.split ?? null;
    const splitParts = Number(splitRaw?.parts);
    const split = Number.isFinite(splitParts) && splitParts >= 2 ? { parts: Math.min(splitParts, 4) } : null;
    await dbg(supabase, { rid, rss: Math.round((Deno.memoryUsage?.().rss ?? 0) / 1048576), ev: "nas-antwort", drucker: used, status: res.status, ms: Date.now() - t0, gesamtMs: Date.now() - tReq, versuche, detail: String(payload?.detail ?? payload?.error ?? "").slice(0, 400), stats: payload?.stats ?? null });
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
    if (teilenMenge && payload?.stats) {
      // Werte für ein Stück auf die ganze Menge hochrechnen, jedes Stück braucht eine eigene Platte
      const st = payload.stats as Record<string, number>;
      payload.stats = { ...st, print_time_s: Number(st.print_time_s) * copies, filament_g: Number(st.filament_g) * copies, ...(st.filament_mm != null ? { filament_mm: Number(st.filament_mm) * copies } : {}) };
      payload.plates = copies;
      payload.copies = copies;
    }
    const platten = Number(payload?.plates ?? payload?.stats?.plates);
    const kopien = Number(payload?.copies ?? payload?.stats?.copies);
    const mengeInfo = copies > 1 && Number.isFinite(platten) && platten >= 1 && kopien === copies
      ? { batch: { copies: kopien, plates: Math.min(500, Math.floor(platten)), printer: used } }
      : {};
    return json({ ok: true, stats: payload.stats ?? null, ...(split ? { split } : {}), ...mengeInfo, ...(gcodeError ? { gcode_error: gcodeError } : {}) });
  } catch (e) {
    console.error("slice-public error:", e);
    try { await dbg(createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!), { rid, ev: "fehler", msg: String((e as Error)?.message ?? e).slice(0, 300) }); } catch { /* ignore */ }
    return json({ ok: false, error: "Slicer nicht erreichbar" });
  } finally {
    if (counted) g.__sliceInflight = Math.max(0, g.__sliceInflight - 1);
    if (aufraeumen) { try { await createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!).storage.from("project-uploads").remove([aufraeumen]); } catch { /* wird spaeter aufgeraeumt */ } }
  }
});
