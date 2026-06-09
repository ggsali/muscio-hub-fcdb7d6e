// AI-generierter Auftragstitel basierend auf Teilen/Nachricht
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { filenames, nachricht, betreff } = await req.json();
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const prompt = `Du erstellst kurze, prägnante Auftragstitel (max. 6 Wörter, auf Deutsch) für einen 3D-Druck Auftrag.
Basierend auf den Dateinamen und der Beschreibung, gib NUR den Titel zurück, keine Anführungszeichen, keine Erklärung.
Wenn möglich, beschreibe das Objekt/Teil (nicht "Preisanfrage" oder "Kalkulator").

Dateien: ${(filenames || []).join(", ") || "keine"}
Betreff: ${betreff || ""}
Nachricht: ${(nachricht || "").slice(0, 500)}`;

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
      return new Response(JSON.stringify({ title: null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const data = await res.json();
    let title = (data?.choices?.[0]?.message?.content || "").trim();
    title = title.replace(/^["'`]+|["'`]+$/g, "").slice(0, 80);
    return new Response(JSON.stringify({ title }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ title: null }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  }
});
