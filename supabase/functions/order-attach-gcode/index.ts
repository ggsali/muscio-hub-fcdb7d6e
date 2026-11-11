import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Admin-Funktion: holt den G-Code eines NAS-Jobs und legt ihn als Datei beim richtigen Teil eines Auftrags ab
// (part-files + part_files). Wird beim Erstellen eines Auftrags aus einer Anfrage aufgerufen.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const ID_RE = /^[0-9a-f-]{36}$/i;
const MAX_BYTES = 120 * 1024 * 1024;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Nur POST erlaubt" }, 405);
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer /, "");
    const { data: userData } = jwt ? await supabase.auth.getUser(jwt) : { data: { user: null } };
    const uid = userData?.user?.id;
    const { data: isAdmin } = uid ? await supabase.rpc("has_role", { _user_id: uid, _role: "admin" }) : { data: false };
    if (!isAdmin) return json({ error: "Nicht berechtigt" }, 403);

    const base = (Deno.env.get("SLICER_URL") || "").replace(/\/+$/, "");
    const key = Deno.env.get("SLICER_API_KEY") || "";
    if (!base || !key) return json({ error: "SLICER_URL / SLICER_API_KEY fehlen" }, 500);

    const b = await req.json().catch(() => ({}));
    const orderId = String(b?.order_id ?? ""), partId = String(b?.part_id ?? ""), jobId = String(b?.nas_job_id ?? "");
    const customerId = b?.customer_id ? String(b.customer_id) : null;
    if (!ID_RE.test(orderId) || !ID_RE.test(partId) || !/^[\w-]{4,80}$/.test(jobId) || (customerId && !ID_RE.test(customerId))) return json({ error: "Ungueltige Anfrage" }, 400);
    const filename = String(b?.filename ?? "teil.gcode").replace(/[^\w.\-]+/g, "_").slice(0, 120) || "teil.gcode";

    const res = await fetch(`${base}/jobs/${encodeURIComponent(jobId)}/gcode`, { headers: { "X-API-Key": key }, signal: AbortSignal.timeout(110_000) });
    if (!res.ok) return json({ error: `G-Code nicht verfuegbar (HTTP ${res.status})` }, 200);
    const len = Number(res.headers.get("content-length") || 0);
    if (len > MAX_BYTES) return json({ error: "G-Code zu gross" }, 200);
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) return json({ error: "G-Code zu gross" }, 200);

    const path = `${orderId}/${partId}/${Date.now()}_${filename}`;
    const { error: upErr } = await supabase.storage.from("part-files").upload(path, buf, { upsert: true, contentType: "text/x.gcode" });
    if (upErr) return json({ error: `Speichern fehlgeschlagen: ${upErr.message}` }, 200);
    const { error: insErr } = await supabase.from("part_files").insert({
      part_id: partId, order_id: orderId, customer_id: customerId, filename, storage_path: path, file_type: "text/x.gcode", file_size_bytes: buf.byteLength,
    });
    if (insErr) return json({ error: insErr.message }, 200);
    return json({ ok: true, bytes: buf.byteLength });
  } catch (e) {
    console.error("order-attach-gcode:", e);
    return json({ error: "Interner Fehler" }, 500);
  }
});
