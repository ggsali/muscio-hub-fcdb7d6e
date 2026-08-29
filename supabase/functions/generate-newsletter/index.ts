// Erstellt einen Newsletter-Entwurf (Betreff + Inhalt) via Lovable AI Gateway.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SYSTEM_PROMPT = `Du bist ein professioneller Newsletter-Texter für 3DMuscio, einen Schweizer B2B 3D-Druckservice in Eschlikon TG. Schreibe einen professionellen Newsletter auf Deutsch.

Ziele:
- Bestehende Kunden zur Rückkehr animieren
- Konkreten Call-to-Action für neuen Auftrag erzeugen
- Professionell aber persönlich (Anrede: Sie)

Struktur (immer einhalten):
1. Anrede: 'Guten Tag [Kundenname],'
2. Aufmerksamkeitsstarke Einleitung (1-2 Sätze)
3. Hauptinhalt: 2-3 kurze Absätze zum Thema
4. Konkreter Nutzen für den Kunden (Sofortpreis, 48h Lieferung, Schweizer Qualität)
5. Call-to-Action: '[LINK_KALKULATOR]'
6. Abschluss: 'Freundliche Grüsse,\nJorim Moos\n3DMuscio'

Regeln:
- Schreibe KEINEN generischen Massen-Newsletter.
- Schreibe als würde Jorim Moos persönlich an einen Geschäftskunden schreiben.
- Kein 'Sehr geehrte Damen und Herren'.
- Beginne direkt mit 'Guten Tag [Kundenname],'
- Erwähne konkret warum JETZT ein guter Zeitpunkt für einen Auftrag ist.
- Maximal 3 kurze Absätze. Kein Marketing-Deutsch.
- Max. 250 Wörter
- Kein Clickbait, kein Übertreiben
- Nur den reinen Newsletter-Text zurückgeben als JSON: { "betreff": "...", "inhalt": "..." }
- Betreff: max. 50 Zeichen, professionell, kein Clickbait`;


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "Nicht angemeldet" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "Nicht angemeldet" }, 401);

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Kein Zugriff" }, 403);

    const body = await req.json().catch(() => ({}));
    const thema = typeof body?.thema === "string" ? body.thema.trim().slice(0, 1000) : "";
    if (!thema) return json({ error: "Thema fehlt" }, 400);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "AI-Key fehlt" }, 500);

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.7-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Thema des Newsletters: ${thema}` },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      console.error("AI Fehler:", resp.status, detail);
      if (resp.status === 429) return json({ error: "AI-Limit erreicht, bitte später erneut versuchen." }, 429);
      return json({ error: "AI-Anfrage fehlgeschlagen" }, 500);
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content ?? "{}";
    let parsed: { betreff?: string; inhalt?: string } = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      return json({ error: "AI-Antwort konnte nicht gelesen werden" }, 500);
    }

    return json({
      betreff: String(parsed.betreff ?? "").slice(0, 120),
      inhalt: String(parsed.inhalt ?? ""),
    });
  } catch (err) {
    console.error("generate-newsletter Fehler:", err);
    return json({ error: String(err) }, 500);
  }
});
