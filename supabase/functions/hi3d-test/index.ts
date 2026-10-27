// Admin-Testzugang zur Hi3D-API (Bild -> 3D). Nur für Admins. Schlüssel liegen als Secrets:
// HITEM3D_CLIENT_ID / HITEM3D_CLIENT_SECRET (Open Platform: platform.hi3d.ai -> Developer -> Create Key)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const API = "https://api.hitem3d.ai/open-api/v1";
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

let tokenCache: { token: string; at: number } | null = null;
async function getToken(force = false): Promise<string> {
  if (!force && tokenCache && Date.now() - tokenCache.at < 20 * 60_000) return tokenCache.token;
  const id = Deno.env.get("HITEM3D_CLIENT_ID"), secret = Deno.env.get("HITEM3D_CLIENT_SECRET");
  if (!id || !secret) throw new Error("Secrets HITEM3D_CLIENT_ID und HITEM3D_CLIENT_SECRET fehlen (Supabase → Edge Functions → Secrets)");
  const r = await fetch(`${API}/auth/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`${id}:${secret}`)}`, "Content-Type": "application/json" },
  });
  const j = await r.json().catch(() => ({}));
  const t = j?.data?.accessToken;
  if (!t) throw new Error(`Hi3D-Anmeldung fehlgeschlagen: ${j?.msg || j?.message || r.status}`);
  tokenCache = { token: t, at: Date.now() };
  return t;
}

// Aufruf mit einmaligem Erneuern des Tokens bei Auth-Fehler
async function hi3d(path: string, init: (token: string) => RequestInit): Promise<{ status: number; body: any }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await getToken(attempt > 0);
    const r = await fetch(`${API}${path}`, init(token));
    const body = await r.json().catch(() => ({}));
    if (r.status === 401 || String(body?.code).startsWith("4001")) { tokenCache = null; continue; }
    return { status: r.status, body };
  }
  throw new Error("Hi3D-Anmeldung wurde abgelehnt");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return json({ error: "Nicht autorisiert" }, 401);
    const authClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData?.user) return json({ error: "Nicht autorisiert" }, 401);
    const { data: isAdmin } = await authClient.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Keine Berechtigung" }, 403);

    const ct = req.headers.get("content-type") || "";
    // --- Task anlegen (multipart: image + Parameter) ---
    if (ct.includes("multipart/form-data")) {
      const inForm = await req.formData();
      const image = inForm.get("image");
      if (!(image instanceof File)) return json({ error: "Bild fehlt" });
      if (image.size > 20 * 1024 * 1024) return json({ error: "Bild grösser als 20 MB" });
      const out = new FormData();
      out.append("images", image, image.name || "bild.png");
      for (const k of ["request_type", "model", "resolution", "face", "format", "pbr"]) {
        const v = inForm.get(k);
        if (typeof v === "string" && v !== "") out.append(k, v);
      }
      const { body } = await hi3d("/submit-task", (token) => ({ method: "POST", headers: { Authorization: `Bearer ${token}` }, body: out }));
      const taskId = body?.data?.task_id;
      if (!taskId) return json({ error: `Hi3D: ${body?.msg || body?.message || "kein Task erstellt"} (Code ${body?.code ?? "?"})` });
      return json({ ok: true, task_id: taskId });
    }

    const body = await req.json().catch(() => ({}));
    const taskId = String(body?.task_id ?? "");
    if (!/^[\w.-]{4,120}$/.test(taskId)) return json({ error: "Ungültige Task-ID" });
    const q = await hi3d(`/query-task?task_id=${encodeURIComponent(taskId)}`, (token) => ({ headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }));
    const d = q.body?.data;
    if (!d) return json({ error: `Hi3D: ${q.body?.msg || q.body?.message || "keine Antwort"} (Code ${q.body?.code ?? "?"})` });

    // --- Status ---
    if (body?.action === "query") {
      return json({ ok: true, state: d.state, cover_url: d.cover_url ?? null, msg: q.body?.msg ?? null });
    }
    // --- Datei laden (URL stammt aus der Hi3D-Antwort, nicht vom Client) ---
    if (body?.action === "file") {
      if (d.state !== "success" || !d.url) return json({ error: `Noch nicht fertig (Status ${d.state})` });
      const f = await fetch(d.url);
      if (!f.ok) return json({ error: `Datei-Download fehlgeschlagen (${f.status})` });
      return new Response(f.body, { headers: { ...corsHeaders, "Content-Type": "application/octet-stream" } });
    }
    return json({ error: "Unbekannte Aktion" });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e).slice(0, 300) });
  }
});
