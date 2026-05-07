// Lovable AI streaming chat for website ChatWidget
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Du bist der freundliche, hilfsbereite Support-Assistent von 3DMuscio – einem Schweizer 3D-Druck-Service (Website: https://3dmuscio.com).
- Antworte kurz, klar und auf Deutsch (Schweizer Höflichkeit).
- Themen: 3D-Druck, Materialien (PLA, PETG, ABS, PA12, Resin u.a.), Lieferzeiten (~48h Standard), Preise, Bestellungen, Shop.
- Wenn etwas Menschliches nötig ist, sage: "Ein Mitarbeiter meldet sich gleich – du kannst hier weiterschreiben."
- WICHTIG zu Links: Verwende AUSSCHLIESSLICH interne, relative Pfade als Markdown-Links, z. B. [Online-Kalkulator](/kalkulator-online), [Materialien](/materialien), [Shop](/shop), [Kontakt](/kontakt), [FAQ](/faq), [Über uns](/ueber-uns). Verwende NIEMALS absolute URLs, niemals lovable.app, niemals andere Domains. Wenn du eine vollständige URL nennen musst, dann nur https://3dmuscio.com/...
- Bei Preisfragen: Preise direkt nennen (siehe oben) und auf 3dmuscio.com/kalkulator-online für eine genaue Berechnung verweisen.
- Bei Materialfragen: auf 3dmuscio.com/materialien verweisen für den detaillierten Vergleich.
- Keine Versprechen zu Lieferterminen ohne Auftragsbestätigung.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { messages } = await req.json();

    // Input validation: cap messages count and total content length
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages must be an array" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (messages.length > 20) {
      return new Response(JSON.stringify({ error: "Zu viele Nachrichten (max. 20)." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    let totalChars = 0;
    for (const m of messages) {
      if (!m || typeof m.content !== "string" || typeof m.role !== "string") {
        return new Response(JSON.stringify({ error: "Ungültiges Nachrichtenformat." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (!["user", "assistant", "system"].includes(m.role)) {
        return new Response(JSON.stringify({ error: "Ungültige Rolle." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      totalChars += m.content.length;
      if (m.content.length > 4000) {
        return new Response(JSON.stringify({ error: "Nachricht zu lang (max. 4000 Zeichen)." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }
    if (totalChars > 8000) {
      return new Response(JSON.stringify({ error: "Konversation zu lang. Bitte starte eine neue." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Simple in-memory per-IP rate limit (best-effort; resets on cold start)
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
    const now = Date.now();
    const WINDOW_MS = 60_000;
    const MAX_REQ = 10;
    // @ts-ignore globalThis cache
    const store: Map<string, number[]> = (globalThis.__chatRateStore ||= new Map());
    const arr = (store.get(ip) || []).filter((t) => now - t < WINDOW_MS);
    if (arr.length >= MAX_REQ) {
      return new Response(JSON.stringify({ error: "Zu viele Anfragen. Bitte kurz warten." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    arr.push(now);
    store.set(ip, arr);

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
