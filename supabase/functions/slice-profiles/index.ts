import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Admin-Funktion: Slicer-Presets ansehen und aendern (Proxy zum Slicer-Dienst, der den API-Key behaelt).
// Aktionen: list | get | save | reset. Nur fuer angemeldete Admins.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const PRINTER_RE = /^[a-z0-9_]{2,20}$/;
const NAME_RE = /^[\w .@()+\-]{1,100}$/;
const KEY_RE = /^[a-z0-9_]{2,60}$/;

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
    if (!base || !key) return json({ error: "SLICER_URL / SLICER_API_KEY sind nicht als Secrets gesetzt" }, 500);
    const headers = { "X-API-Key": key, "Content-Type": "application/json" };

    const b = await req.json().catch(() => ({}));
    const action = String(b?.action ?? "");
    const printer = String(b?.printer ?? "");
    const name = String(b?.name ?? "");
    const call = async (path: string, init?: RequestInit) => {
      const r = await fetch(`${base}${path}`, { ...init, headers, signal: AbortSignal.timeout(20_000) }).catch(() => null);
      if (!r) return json({ error: "Slicer nicht erreichbar" }, 200);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        const det = d?.detail ?? d?.error;
        const text = typeof det === "string" ? det : Array.isArray(det) ? det.map((x: unknown) => (typeof x === "string" ? x : JSON.stringify(x))).join("; ") : det ? JSON.stringify(det) : `Slicer antwortet mit ${r.status}`;
        return json({ error: text.slice(0, 500), status: r.status }, 200);
      }
      return json(d);
    };

    if (action === "list") return await call("/profiles");
    if (!PRINTER_RE.test(printer) || !NAME_RE.test(name)) return json({ error: "Ungültiger Drucker oder Name" }, 400);
    const pfad = `/profiles/${encodeURIComponent(printer)}/${encodeURIComponent(name)}`;
    if (action === "get") return await call(pfad);
    if (action === "save") {
      const ov = b?.overrides;
      if (!ov || typeof ov !== "object" || Array.isArray(ov)) return json({ error: "overrides fehlt" }, 400);
      const clean: Record<string, string | number | boolean> = {};
      for (const [k, v] of Object.entries(ov)) {
        if (!KEY_RE.test(k) || !["string", "number", "boolean"].includes(typeof v) || String(v).length > 60) return json({ error: `Ungültiger Wert für ${k}` }, 400);
        clean[k] = v as string | number | boolean;
      }
      return await call(pfad, { method: "PUT", body: JSON.stringify({ overrides: clean }) });
    }
    if (action === "reset") {
      const keys = Array.isArray(b?.keys) ? (b.keys as unknown[]).map(String).filter((k) => KEY_RE.test(k)) : null;
      return await call(`${pfad}/overrides`, { method: "DELETE", body: JSON.stringify({ keys }) });
    }
    return json({ error: "Ungültige Aktion" }, 400);
  } catch (e) {
    console.error("slice-profiles:", e);
    return json({ error: "Interner Fehler" }, 500);
  }
});
