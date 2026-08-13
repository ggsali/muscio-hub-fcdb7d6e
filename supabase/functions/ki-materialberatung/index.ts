// KI-Materialberatung für den Online-Kalkulator
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Du bist ein Experte für 3D-Druck-Materialien bei 3DMuscio in der Schweiz. Du hilfst Kunden das optimale Material zu wählen. Verfügbare Materialien: PLA (Standard, günstig, Innenbereich, bis 60°C), PETG (feuchtigkeitsbeständig, lebensmittelecht, bis 80°C), ABS (schlagfest, bis 100°C, Innen), ASA (UV-beständig, Aussenbereich, bis 100°C), TPU (flexibel, gummiartig, schlagabsorbierend), Resin/SLA (hochauflösend, glatte Oberfläche, Sichtteile). Stelle immer nur EINE Frage auf einmal. Antworte auf Deutsch. Halte Antworten kurz und professionell. Nach 5 Antworten gib eine klare Materialempfehlung mit 2-3 Sätzen Begründung.`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { answers, fileName, geometry, availableMaterials } = await req.json();
    if (!answers || typeof answers !== "object") {
      return json({ error: "answers fehlt" }, 400);
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "AI-Key fehlt" }, 500);

    const list = Array.isArray(availableMaterials) && availableMaterials.length > 0
      ? availableMaterials.join(", ")
      : "PLA, PETG, ABS, ASA, TPU, Resin";

    const userPrompt = `Kundenangaben zum Bauteil:
Datei: ${fileName || "unbekannt"}
Geometrie: ${geometry || "unbekannt"}
Verwendungszweck: ${answers.zweck || "-"}
Mechanische Belastung: ${answers.belastung || "-"}
Einsatzort: ${answers.einsatzort || "-"}
Temperaturanforderung: ${answers.temperatur || "-"}
Flexibilität: ${answers.flexibilitaet || "-"}

Wähle GENAU EIN Material aus dieser Liste (Name exakt so schreiben): ${list}

Antworte ausschliesslich als JSON:
{"material":"<Materialname aus der Liste>","begruendung":"<2-3 Sätze Begründung auf Deutsch>"}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (resp.status === 429) return json({ error: "Zu viele Anfragen, bitte kurz warten." }, 429);
    if (resp.status === 402) return json({ error: "AI-Guthaben aufgebraucht." }, 402);
    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI-Fehler", t);
      return json({ error: "AI-Fehler" }, 500);
    }

    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content ?? "{}";
    let parsed: { material?: string; begruendung?: string } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = String(raw).match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch { /* ignore */ } }
    }

    return json({
      material: parsed.material || "PLA",
      begruendung: parsed.begruendung || "Basierend auf deinen Angaben ist dieses Material die beste Wahl.",
    });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
