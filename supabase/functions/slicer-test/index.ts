import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Admin-Testfunktion: leitet ein Modell an den Auto-Slicer auf dem NAS weiter.
// Secrets (Supabase → Edge Functions → Secrets): SLICER_URL, SLICER_API_KEY.
// Der API-Key verlässt diese Funktion nie.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Expose-Headers": "content-disposition",
};

const MAX_BYTES = 50 * 1024 * 1024;
const TIMEOUT_MS = 120_000;
const ALLOWED_EXT = [".stl", ".obj", ".3mf"];
const QUALITIES = ["0.08", "0.12", "0.16", "0.20"];
const JOB_ID_RE = /^[0-9a-f]{32}$/;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Nur POST erlaubt" }, 405);

  try {
    // Nur angemeldete Admins.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const { data: userData } = jwt ? await supabase.auth.getUser(jwt) : { data: { user: null } };
    const uid = userData?.user?.id;
    const { data: isAdmin } = uid
      ? await supabase.rpc("has_role", { _user_id: uid, _role: "admin" })
      : { data: false };
    if (!isAdmin) return json({ error: "Nicht berechtigt" }, 403);

    const base = (Deno.env.get("SLICER_URL") || "").replace(/\/+$/, "");
    const key = Deno.env.get("SLICER_API_KEY") || "";
    if (!base || !key) return json({ error: "SLICER_URL / SLICER_API_KEY sind nicht als Secrets gesetzt" }, 500);

    const headers = { "X-API-Key": key };
    const contentType = req.headers.get("content-type") || "";

    // ---- G-Code herunterladen: JSON {action:"gcode", job_id} ----
    if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      if (!["gcode", "queue"].includes(body?.action) || !JOB_ID_RE.test(String(body?.job_id ?? ""))) {
        return json({ error: "Ungültige Anfrage" }, 400);
      }
      if (body.action === "queue") {
        // G-Code des Auftrags an SimplyPrint schicken (Zugangsdaten liegen auf dem NAS)
        const qres = await fetch(`${base}/jobs/${body.job_id}/simplyprint`, {
          method: "POST",
          headers,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        const qdata = await qres.json().catch(() => ({}));
        if (!qres.ok) return json({ error: qdata?.detail || `Slicer antwortet mit ${qres.status}` }, qres.status);
        return json({ ok: true, simplyprint: qdata?.simplyprint ?? null });
      }
      const res = await fetch(`${base}/jobs/${body.job_id}/gcode`, {
        headers,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        return json({ error: detail?.detail || `Slicer antwortet mit ${res.status}` }, res.status);
      }
      return new Response(res.body, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/plain",
          "Content-Disposition":
            res.headers.get("content-disposition") || `attachment; filename="${body.job_id.slice(0, 8)}.gcode"`,
        },
      });
    }

    // ---- Slicen: multipart/form-data ----
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return json({ error: "Datei fehlt" }, 400);
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (!ALLOWED_EXT.includes(ext)) return json({ error: `Dateityp ${ext} nicht erlaubt (STL, OBJ, 3MF)` }, 422);
    if (file.size > MAX_BYTES) return json({ error: "Datei ist grösser als 50 MB" }, 413);

    const quality = String(form.get("quality") ?? "0.20");
    if (!QUALITIES.includes(quality)) return json({ error: "Ungültige Qualität" }, 422);

    // auto=true: NAS wählt den freien Drucker, bewertet das Teil und reiht es (optional) ein
    const auto = form.get("auto") === "true";
    const enqueue = form.get("enqueue") === "true";

    const out = new FormData();
    out.append("file", file, file.name);
    if (!auto) out.append("printer", "k1c");
    if (auto) out.append("enqueue", enqueue ? "true" : "false");
    out.append("material", "pla");
    out.append("quality", quality);
    for (const name of ["infill", "walls"]) {
      const v = String(form.get(name) ?? "").trim();
      if (v) {
        if (!/^\d{1,3}$/.test(v)) return json({ error: `Ungültiger Wert für ${name}` }, 422);
        out.append(name, v);
      }
    }
    out.append("supports", form.get("supports") === "false" ? "false" : "true");
    out.append("orient", form.get("orient") === "false" ? "false" : "true");
    out.append("reference", `test-${uid!.slice(0, 8)}`);

    let res: Response;
    try {
      res = await fetch(`${base}${auto ? "/auto" : "/slice"}`, {
        method: "POST",
        headers,
        body: out,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e) {
      const timedOut = e instanceof DOMException && e.name === "TimeoutError";
      return json(
        { error: timedOut ? "Zeitüberschreitung: der Slicer hat nicht rechtzeitig geantwortet" : "Slicer nicht erreichbar" },
        504,
      );
    }
    const payload = await res.json().catch(() => ({ error: `Slicer antwortet mit ${res.status}` }));
    if (!res.ok) {
      return json({ error: payload?.detail || payload?.error || `Slicer antwortet mit ${res.status}`, status: res.status }, res.status);
    }
    return json(payload);
  } catch (e) {
    console.error("slicer-test error:", e);
    return json({ error: "Interner Fehler" }, 500);
  }
});
