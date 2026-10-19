import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Admin-Funktion: geslictes Teil freigeben (→ SimplyPrint-Queue), ablehnen oder G-Code laden.
// Nur für angemeldete Admins. Der Slicer-API-Key verlässt diese Funktion nie.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Expose-Headers": "content-disposition",
};
const TIMEOUT_MS = 120_000;
const ID_RE = /^[0-9a-f-]{36}$/i;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

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
    const headers = { "X-API-Key": key };

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");
    const id = String(body?.id ?? "");
    if (!["approve", "reject", "gcode"].includes(action) || !ID_RE.test(id)) return json({ error: "Ungültige Anfrage" }, 400);

    const { data: job } = await supabase.from("slice_jobs").select("*").eq("id", id).maybeSingle();
    if (!job) return json({ error: "Eintrag nicht gefunden" }, 404);

    if (action === "gcode") {
      if (!job.nas_job_id) return json({ error: "Kein G-Code vorhanden" }, 409);
      const res = await fetch(`${base}/jobs/${job.nas_job_id}/gcode`, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        return json({ error: d?.detail || `Slicer antwortet mit ${res.status} (G-Code evtl. nach 14 Tagen gelöscht)` }, res.status);
      }
      return new Response(res.body, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/plain",
          "Content-Disposition": res.headers.get("content-disposition") || `attachment; filename="${id.slice(0, 8)}.gcode"`,
        },
      });
    }

    if (job.status !== "pending") return json({ error: `Eintrag ist bereits "${job.status}"` }, 409);

    if (action === "reject") {
      await supabase.from("slice_jobs").update({ status: "rejected", decided_at: new Date().toISOString(), decided_by: uid }).eq("id", id);
      return json({ ok: true, status: "rejected" });
    }

    // approve: G-Code an SimplyPrint schicken (Menge = bestellte Stückzahl)
    const amount = Math.max(1, Math.min(50, Number(job.quantity) || 1));
    let res: Response;
    try {
      res = await fetch(`${base}/jobs/${job.nas_job_id}/simplyprint?amount=${amount}`, {
        method: "POST",
        headers,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      return json({ error: "Slicer nicht erreichbar" }, 504);
    }
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) return json({ error: payload?.detail || `Slicer antwortet mit ${res.status}` }, res.status);
    await supabase.from("slice_jobs").update({
      status: "approved",
      simplyprint: payload?.simplyprint ?? null,
      decided_at: new Date().toISOString(),
      decided_by: uid,
    }).eq("id", id);
    return json({ ok: true, status: "approved", simplyprint: payload?.simplyprint ?? null });
  } catch (e) {
    console.error("slice-decision error:", e);
    return json({ error: "Interner Fehler" }, 500);
  }
});
