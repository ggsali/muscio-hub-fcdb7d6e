import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Gravur-Werkzeug (Admin): Modell und Bilder liegen im Storage (project-uploads/gravur/<job>/), der Server (muscio)
// holt sie selbst per signierter URL, rechnet (Potrace + Manifold) und legt das Ergebnis-ZIP per signierter Upload-URL zurück.
// Diese Funktion reicht nur URLs und Einstellungen durch, es laufen keine grossen Dateien durch sie hindurch.
// Aktionen: init (signierte Upload-URLs), start (Auftrag an den Server), status (Fortschritt, bei fertig: Download-URL), cleanup.
// Secrets: SLICER_URL, SLICER_API_KEY (wie server-files). Der Key verlässt diese Funktion nie.

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
    const key = Deno.env.get("SLICER_API_KEY") || "";
    if (!base || !key) return json({ error: "SLICER_URL / SLICER_API_KEY sind nicht als Secrets gesetzt" }, 500);

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
        colors: { modell: /^#[0-9a-f]{6}$/i.test(body.colModell) ? body.colModell : "#9AA3AD", einlage: /^#[0-9a-f]{6}$/i.test(body.colEinlage) ? body.colEinlage : "#14B8A6" },
        model_name: safe(body.model_name),
        result_put_url: res.signedUrl,
      };
      const r = await fetch(`${base}/gravur/jobs`, {
        method: "POST", headers: { "X-API-Key": key, "Content-Type": "application/json" }, body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000),
      });
      const t = await r.text();
      if (!r.ok) return json({ error: `Server: ${r.status} ${t.slice(0, 300)}` }, 502);
      let j: { id?: string } = {};
      try { j = JSON.parse(t); } catch { /* */ }
      return json({ slicer_id: j.id ?? job });
    }

    if (action === "status") {
      const job = String(body.job ?? "");
      const sid = String(body.slicer_id ?? "");
      if (!UUID.test(job) || !/^[A-Za-z0-9_-]{6,64}$/.test(sid)) return json({ error: "Ungültige Angaben" }, 400);
      const r = await fetch(`${base}/gravur/jobs/${sid}`, { headers: { "X-API-Key": key }, signal: AbortSignal.timeout(15_000) });
      const t = await r.text();
      if (!r.ok) return json({ error: `Server: ${r.status} ${t.slice(0, 300)}` }, 502);
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
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
