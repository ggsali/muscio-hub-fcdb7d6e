// KI-Materialberatung für den Online-Kalkulator (echter Dialog)
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, fileName, geometry, availableMaterials, partNames } = await req.json();
    if (!Array.isArray(messages)) return json({ error: "messages fehlt" }, 400);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "AI-Key fehlt" }, 500);

    const list = Array.isArray(availableMaterials) && availableMaterials.length > 0
      ? availableMaterials.join(", ")
      : "PLA, PETG, ABS, ASA, TPU, Resin";

    const partList: string[] = Array.isArray(partNames) ? partNames.filter((n: unknown) => typeof n === "string" && n) : [];
    const multiPart = partList.length > 1;
    const MULTI_BLOCK = multiPart
      ? `

WICHTIG - Der Kunde hat ${partList.length} Teile hochgeladen: ${partList.join(", ")}.
- Kläre ZUERST, ob alle Teile zum gleichen Bauteil/zur gleichen Baugruppe gehören oder ob jedes Teil eine eigene Funktion hat.
- Gehören sie zusammen: ein gemeinsames Material empfehlen (ausser ein Teil braucht z. B. Flexibilität).
- Haben die Teile unterschiedliche Funktionen: frage die Funktionen der Reihe nach ab und empfehle pro Teil ein Material. Nenne die Empfehlungen im Text klar pro Teilname und schreibe in "empfehlung" das Material, das für die meisten Teile passt (Hauptmaterial).`
      : "";

    const SYSTEM_PROMPT = `Du bist ein erfahrener Berater für 3D-Druck-Materialien bei 3DMuscio in der Schweiz.

Materialwissen: PLA (Standard, günstig, Innenbereich, bis 60°C), PETG (feuchtigkeitsbeständig, lebensmittelecht, bis 80°C), ABS (schlagfest, bis 100°C, Innen), ASA (UV-beständig, Aussenbereich, bis 100°C), TPU (flexibel, gummiartig), Resin/SLA (hochauflösend, glatte Sichtteile).

Kontext zum Bauteil des Kunden:
- Datei: ${fileName || "unbekannt"}
- Geometrie: ${geometry || "unbekannt"}
- Wählbare Materialien (Name exakt so verwenden): ${list}

So arbeitest du:
- Du führst ein echtes Gespräch auf Deutsch, locker und professionell, du duzt den Kunden.
- Stelle immer nur EINE Frage auf einmal und halte deine Antworten kurz (max. 3-4 Sätze).
- Wichtige Punkte: Verwendungszweck, mechanische Belastung, Innen/Aussen, Temperatur, Flexibilität, Optik.
- Der Kunde darf jederzeit Rückfragen stellen, widersprechen oder Alternativen vergleichen — antworte darauf inhaltlich und beende das Gespräch nicht.
- Sobald du genug weisst, gib eine klare Empfehlung ab und erkläre sie kurz. Danach bleibst du weiter im Gespräch und beantwortest Rückfragen (auch mit geänderter Empfehlung, wenn neue Infos das rechtfertigen).

Antworte AUSSCHLIESSLICH als JSON:
{"antwort":"<deine Gesprächsantwort auf Deutsch>","empfehlung":"<Materialname aus der Liste oder leer, wenn noch keine Empfehlung>","begruendung":"<2-3 Sätze Begründung oder leer>"}${MULTI_BLOCK}`;

    const chat = messages
      .filter((m: any) => m && typeof m.content === "string" && m.content.trim())
      .slice(-30)
      .map((m: any) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...chat],
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
    let parsed: { antwort?: string; empfehlung?: string; begruendung?: string } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = String(raw).match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch { /* ignore */ } }
    }

    return json({
      antwort: parsed.antwort || String(raw),
      empfehlung: parsed.empfehlung || null,
      begruendung: parsed.begruendung || null,
    });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
