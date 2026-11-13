import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Gravur-Werkzeug (Admin): Modell und Bilder liegen im Storage (project-uploads/gravur/<job>/), der Server (muscio)
// holt sie selbst per signierter URL, rechnet (Potrace + Manifold) und legt das Ergebnis-ZIP per signierter Upload-URL zurück.
// Diese Funktion reicht nur URLs und Einstellungen durch, es laufen keine grossen Dateien durch sie hindurch.
// Aktionen: init (signierte Upload-URLs), start (Auftrag an den Server), status (Fortschritt, bei fertig: Download-URL), cleanup.
// Secrets: SLICER_URL (nur die Basis-Adresse des Funnels) und GRAVUR_API_KEY (eigener Schlüssel des Gravur-Dienstes).
// Der Slicer-Schlüssel wird hier bewusst NICHT verwendet. Der Gravur-Schlüssel verlässt diese Funktion nie und wird nie geloggt.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const BUCKET = "project-uploads";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const safe = (s: unknown) => String(s ?? "").replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "bild";
const ext = (s: unknown, ok: RegExp, d: string) => { const m = String(s ?? "").toLowerCase().match(/\.([a-z0-9]{2,5})$/); return m && ok.test(m[1]) ? m[1] : d; };
const num = (v: unknown, d: number, a: number, b: number) => { const n = Number(v); return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d; };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Nur POST erlaubt" }, 405);
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const { data: userData } = jwt ? await supabase.auth.getUser(jwt) : { data: { user: null } };
    const uid = userData?.user?.id;
    const { data: isAdmin } = uid ? await supabase.rpc("has_role", { _user_id: uid, _role: "admin" }) : { data: false };
    if (!isAdmin) return json({ error: "Nicht berechtigt" }, 403);

    const base = (Deno.env.get("SLICER_URL") || "").replace(/\/+$/, "");
    const gravurKey = (Deno.env.get("GRAVUR_API_KEY") || "").trim();
    if (!gravurKey) return json({ error: "GRAVUR_API_KEY nicht konfiguriert" }, 500);
    if (!base) return json({ error: "SLICER_URL nicht konfiguriert" }, 500);

    // Einziger Weg zum Gravur-Dienst: setzt immer den Gravur-Schlüssel, nie den Slicer-Schlüssel.
    const gravurFetch = async (path: string, init: RequestInit & { timeoutMs: number }) => {
      if (!path.startsWith("/gravur/")) throw new Error("Ungültiger Gravur-Pfad");
      const { timeoutMs, headers, ...rest } = init;
      const r = await fetch(`${base}${path}`, {
        ...rest,
        headers: { ...(headers as Record<string, string> | undefined), "X-API-Key": gravurKey },
        signal: AbortSignal.timeout(timeoutMs),
      });
      const t = await r.text();
      return { r, t };
    };
    const gravurError = (r: Response, t: string) =>
      r.status === 401 || r.status === 403
        ? json({ error: "Gravur-Authentifizierung fehlgeschlagen" }, 502)
        : json({ error: `Gravur-Server: ${r.status} ${t.replaceAll(gravurKey, "***").slice(0, 300)}` }, 502);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");
    const st = supabase.storage.from(BUCKET);

    if (action === "init") {
      const names: unknown[] = Array.isArray(body.images) ? body.images.slice(0, 500) : [];
      if (!names.length) return json({ error: "Keine Bilder angegeben" }, 400);
      const job = crypto.randomUUID();
      const up = async (path: string) => {
        const { data, error } = await st.createSignedUploadUrl(path);
        if (error || !data) throw new Error(`Upload-URL fehlgeschlagen: ${error?.message}`);
        return { path, token: data.token };
      };
      const model = await up(`gravur/${job}/modell.${ext(body.model_name, /^(stl|obj)$/, "stl")}`);
      const images = [];
      for (let i = 0; i < names.length; i++) {
        const nm = safe(names[i]);
        const e = ext(names[i], /^(png|jpg|jpeg|webp|gif|bmp|svg)$/, "png");
        images.push({ ...(await up(`gravur/${job}/bild-${String(i + 1).padStart(3, "0")}-${nm}.${e}`)), name: nm });
      }
      return json({ job, model, images });
    }

    // Gespeicherte Logos: bleiben im Storage (gravur/logos/), Auftragsdateien werden dagegen nach dem Lauf gelöscht.
    if (action === "logo_list") {
      const { data } = await st.list("gravur/logos", { limit: 200, sortBy: { column: "created_at", order: "desc" } });
      const files = (data ?? []).filter((f) => f.name && !f.name.startsWith(".") && f.id);
      const logos = [];
      for (const f of files) {
        const path = `gravur/logos/${f.name}`;
        const { data: u } = await st.createSignedUrl(path, 3600);
        if (u) logos.push({ name: f.name.replace(/\.[^.]+$/, ""), path, url: u.signedUrl });
      }
      return json({ logos });
    }
    if (action === "logo_init") {
      const nm = safe(body.name);
      const e = ext(body.name, /^(png|jpg|jpeg|webp)$/, "png");
      const path = `gravur/logos/${nm}.${e}`;
      const { data, error } = await st.createSignedUploadUrl(path, { upsert: true });
      if (error || !data) return json({ error: `Upload-URL fehlgeschlagen: ${error?.message}` }, 500);
      return json({ path, token: data.token, name: nm });
    }
    if (action === "logo_delete") {
      const path = String(body.path ?? "");
      if (!/^gravur\/logos\/[A-Za-z0-9_-]{1,40}\.(png|jpg|jpeg|webp)$/.test(path)) return json({ error: "Ungültiger Pfad" }, 400);
      await st.remove([path]);
      return json({ ok: true });
    }

    if (action === "start") {
      const job = String(body.job ?? "");
      if (!UUID.test(job)) return json({ error: "Ungültiger Auftrag" }, 400);
      const modelPath = String(body.model_path ?? "");
      const imgs: { path: string; name: string }[] = Array.isArray(body.images) ? body.images : [];
      if (!modelPath.startsWith(`gravur/${job}/`) || !imgs.length || imgs.some((i) => !String(i.path).startsWith(`gravur/${job}/`))) return json({ error: "Ungültige Pfade" }, 400);
      const sign = async (path: string) => {
        const { data, error } = await st.createSignedUrl(path, 3600);
        if (error || !data) throw new Error(`Datei nicht gefunden: ${path}`);
        return data.signedUrl;
      };
      const { data: res, error: re } = await st.createSignedUploadUrl(`gravur/${job}/ergebnis.zip`, { upsert: true });
      if (re || !res) return json({ error: `Ergebnis-URL fehlgeschlagen: ${re?.message}` }, 500);
      const frame = Array.isArray(body.frame) && body.frame.length === 16 ? body.frame.map((v: unknown) => num(v, 0, -1e7, 1e7)) : null;
      if (!frame) return json({ error: "Fläche (frame) fehlt" }, 400);
      const p = body.place ?? {};
      const placeOf = (q: Record<string, unknown>) => ({
        widthMm: num(q.widthMm, 20, 1, 2000), dx: num(q.dx, 0, -2000, 2000), dy: num(q.dy, 0, -2000, 2000),
        rotDeg: num(q.rotDeg, 0, -360, 360), depth: num(q.depth, 0.6, 0.05, 100), centerInk: !!q.centerInk,
      });
      const seedOf = (v: unknown) => (Array.isArray(v) && v.length === 3 ? v.map((x: unknown) => num(x, 0, -1e7, 1e7)) : null);
      let logo: Record<string, unknown> | null = null;
      if (body.logo) {
        const l = body.logo;
        const lp = String(l.path ?? "");
        if (!/^gravur\/logos\/[A-Za-z0-9_-]{1,40}\.(png|jpg|jpeg|webp)$/.test(lp)) return json({ error: "Ungültiges Logo" }, 400);
        const lf = Array.isArray(l.frame) && l.frame.length === 16 ? l.frame.map((v: unknown) => num(v, 0, -1e7, 1e7)) : null;
        if (!lf) return json({ error: "Fläche des Logos fehlt" }, 400);
        logo = {
          name: safe(lp.split("/").pop()), url: await sign(lp), frame: lf, place: placeOf(l.place ?? {}), seed: seedOf(l.seed),
          image: { threshold: l.threshold == null ? null : num(l.threshold, 128, 1, 254), invert: l.invert == null ? null : !!l.invert },
        };
      }
      const payload = {
        job_id: job,
        model_url: await sign(modelPath),
        images: await Promise.all(imgs.map(async (i) => ({ name: safe(i.name), url: await sign(String(i.path)) }))),
        frame,
        place: {
          widthMm: num(p.widthMm, 60, 1, 2000), dx: num(p.dx, 0, -2000, 2000), dy: num(p.dy, 0, -2000, 2000),
          rotDeg: num(p.rotDeg, 0, -360, 360), depth: num(p.depth, 0.6, 0.05, 100), centerInk: !!p.centerInk,
        },
        image: { threshold: body.threshold == null ? null : num(body.threshold, 128, 1, 254), invert: body.invert == null ? null : !!body.invert },
        colors: {
          modell: /^#[0-9a-f]{6}$/i.test(body.colModell) ? body.colModell : "#9AA3AD",
          einlage: /^#[0-9a-f]{6}$/i.test(body.colEinlage) ? body.colEinlage : "#14B8A6",
          logo: /^#[0-9a-f]{6}$/i.test(body.colLogo) ? body.colLogo : "#A855F7",
        },
        logo,
        bed: !!body.bed,
        seed: Array.isArray(body.seed) && body.seed.length === 3 ? body.seed.map((v: unknown) => num(v, 0, -1e7, 1e7)) : null,
        model_name: safe(body.model_name),
        result_put_url: res.signedUrl,
      };
      const { r, t } = await gravurFetch("/gravur/jobs", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), timeoutMs: 30_000,
      });
      if (!r.ok) return gravurError(r, t);
      let j: { id?: string } = {};
      try { j = JSON.parse(t); } catch { /* */ }
      return json({ slicer_id: j.id ?? job });
    }

    if (action === "status") {
      const job = String(body.job ?? "");
      const sid = String(body.slicer_id ?? "");
      if (!UUID.test(job) || !/^[A-Za-z0-9_-]{6,64}$/.test(sid)) return json({ error: "Ungültige Angaben" }, 400);
      const { r, t } = await gravurFetch(`/gravur/jobs/${sid}`, { timeoutMs: 15_000 });
      if (!r.ok) return gravurError(r, t);
      const j = JSON.parse(t);
      if (j.status === "done") {
        const { data, error } = await st.createSignedUrl(`gravur/${job}/ergebnis.zip`, 900);
        if (error || !data) return json({ ...j, status: "error", error: "Ergebnis-ZIP wurde nicht hochgeladen" });
        return json({ ...j, download_url: data.signedUrl });
      }
      return json(j);
    }

    if (action === "cleanup") {
      const job = String(body.job ?? "");
      if (!UUID.test(job)) return json({ error: "Ungültiger Auftrag" }, 400);
      const { data } = await st.list(`gravur/${job}`, { limit: 1000 });
      if (data?.length) await st.remove(data.map((f) => `gravur/${job}/${f.name}`));
      return json({ ok: true });
    }

    return json({ error: "Unbekannte Aktion" }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const k = (Deno.env.get("GRAVUR_API_KEY") || "").trim();
    return json({ error: k ? msg.replaceAll(k, "***") : msg }, 500);
  }
});
