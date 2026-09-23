// AI-generierter Auftragstitel basierend auf Teilen/Nachricht (nur für Admins)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

    const body = await req.json().catch(() => ({}));
    const filenames: string[] = Array.isArray(body?.filenames)
      ? body.filenames.filter((f: unknown) => typeof f === "string").slice(0, 20).map((f: string) => f.slice(0, 200))
      : [];
    const betreff = typeof body?.betreff === "string" ? body.betreff.slice(0, 200) : "";
    const nachricht = typeof body?.nachricht === "string" ? body.nachricht.slice(0, 500) : "";

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const prompt = `Du erstellst kurze, prägnante Auftragstitel (max. 6 Wörter, auf Deutsch) für einen 3D-Druck Auftrag.
Basierend auf den Dateinamen und der Beschreibung, gib NUR den Titel zurück, keine Anführungszeichen, keine Erklärung.
Wenn möglich, beschreibe das Objekt/Teil (nicht "Preisanfrage" oder "Kalkulator").

Dateien: ${filenames.join(", ") || "keine"}
Betreff: ${betreff}
Nachricht: ${nachricht}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      console.error("AI error", res.status, await res.text());
      return json({ title: null });
    }
    const data = await res.json();
    let title = (data?.choices?.[0]?.message?.content || "").trim();
    title = title.replace(/^["'`]+|["'`]+$/g, "").slice(0, 80);
    return json({ title });
  } catch (e) {
    console.error(e);
    return json({ title: null });
  }
});
