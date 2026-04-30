// Lovable AI streaming chat for website ChatWidget
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Du bist der freundliche, hilfsbereite Support-Assistent von 3DMuscio – einem Schweizer 3D-Druck-Service.
- Antworte kurz, klar und auf Deutsch (Schweizer Höflichkeit).
- Themen: 3D-Druck, Materialien (PLA, PETG, ABS, PA12, Resin u.a.), Lieferzeiten (~48h Standard), Preise (Online-Kalkulator unter /kalkulator-online), Bestellungen, Shop.
- Wenn etwas Menschliches nötig ist, sage: "Ein Mitarbeiter meldet sich gleich – du kannst hier weiterschreiben."
- Bei Preisfragen verweise auf /kalkulator-online. Bei Materialien auf /materialien.
- Keine Versprechen zu Lieferterminen ohne Auftragsbestätigung.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { messages } = await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        stream: true,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...(messages || [])],
      }),
    });
    if (resp.status === 429) {
      return new Response(JSON.stringify({ error: "Limit erreicht, bitte später erneut versuchen." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (resp.status === 402) {
      return new Response(JSON.stringify({ error: "Guthaben aufgebraucht – Lovable AI." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!resp.ok || !resp.body) {
      const t = await resp.text();
      return new Response(JSON.stringify({ error: t || "AI-Fehler" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(resp.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
