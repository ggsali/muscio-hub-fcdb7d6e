import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Admin-Dateiansicht für den Server (muscio): leitet nur LESENDE Abfragen an den Slicer weiter
// (/files/info, /files/list, /files/download). Der Slicer sperrt Geheimnisse (.env, Schlüssel) selbst.
// Secrets (Supabase → Edge Functions → Secrets): SLICER_URL, SLICER_API_KEY.
// Der API-Key verlässt diese Funktion nie.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Expose-Headers": "content-disposition, content-length",
};

const TIMEOUT_MS = 60_000;
const DOWNLOAD_TIMEOUT_MS = 140_000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** Pfad relativ zum Server-Datenordner: keine absoluten Pfade, kein "..", keine Steuerzeichen. */
function cleanPath(raw: unknown): string | null {
  const p = String(raw ?? "").replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
  if (p.length > 500) return null;
  // deno-lint-ignore no-control-regex
  if (/[\u0000-\u001f]/.test(p)) return null;
  const parts = p.split("/").filter(Boolean);
  if (parts.some((s) => s === ".." || s === ".")) return null;
  return parts.join("/");
}

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

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");

    const proxyJson = async (url: string) => {
      let res: Response;
      try {
        res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
      } catch (e) {
        const timedOut = e instanceof DOMException && e.name === "TimeoutError";
        return json({ error: timedOut ? "Zeitüberschreitung: der Server hat nicht geantwortet" : "Server nicht erreichbar" }, 504);
      }
      const payload = await res.json().catch(() => ({}));
      if (res.status === 404 && !payload?.detail) {
        return json({ error: "Der Slicer kennt die Datei-Abfragen noch nicht (Slicer-Update auf dem Server fehlt)" }, 501);
      }
      if (!res.ok) return json({ error: payload?.detail || payload?.error || `Server antwortet mit ${res.status}` }, res.status);
      return json(payload);
    };

    if (action === "info") return await proxyJson(`${base}/files/info`);

    if (action === "list") {
      const path = cleanPath(body?.path);
      if (path === null) return json({ error: "Ungültiger Pfad" }, 400);
      return await proxyJson(`${base}/files/list?path=${encodeURIComponent(path)}`);
    }

    if (action === "download") {
      const path = cleanPath(body?.path);
      if (!path) return json({ error: "Ungültiger Pfad" }, 400);
      let res: Response;
      try {
        res = await fetch(`${base}/files/download?path=${encodeURIComponent(path)}`, {
          headers,
          signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
        });
      } catch (_e) {
        return json({ error: "Server nicht erreichbar" }, 504);
      }
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        return json({ error: detail?.detail || `Server antwortet mit ${res.status}` }, res.status);
      }
      const name = path.split("/").pop() || "datei";
      const outHeaders: Record<string, string> = {
        ...corsHeaders,
        "Content-Type": res.headers.get("content-type") || "application/octet-stream",
        "Content-Disposition":
          res.headers.get("content-disposition") || `attachment; filename="${name.replace(/[^\w.\- ]/g, "_")}"`,
      };
      const len = res.headers.get("content-length");
      if (len) outHeaders["Content-Length"] = len;
      return new Response(res.body, { status: 200, headers: outHeaders });
    }

    return json({ error: "Ungültige Anfrage" }, 400);
  } catch (e) {
    console.error("server-files error:", e);
    return json({ error: "Interner Fehler" }, 500);
  }
});
