import { createClient } from "npm:@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const OPEN_STATUSES = ["Offen", "Bezahlt", "Produktion", "In Bearbeitung"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    let neuerAuftragSekunden = 0;
    try {
      const body = await req.json();
      const raw = Number(body?.neuer_auftrag_sekunden);
      if (Number.isFinite(raw) && raw > 0) neuerAuftragSekunden = Math.min(raw, 30 * 24 * 3600);
    } catch {
      // leerer Body ist erlaubt
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const [{ data: offeneAuftraege }, { data: settingRows }] = await Promise.all([
      supabase
        .from("orders")
        .select("id, status, parts:parts(slicer_druckzeit_sekunden)")
        .in("status", OPEN_STATUSES)
        .order("created_at", { ascending: true }),
      supabase.from("settings").select("key, value").in("key", ["drucker_anzahl", "druckstunden_pro_tag"]),
    ]);

    const settings: Record<string, number> = {};
    for (const row of settingRows ?? []) {
      const num = parseFloat(String(row.value));
      if (Number.isFinite(num)) settings[row.key] = num;
    }
    const druckerAnzahl = Math.max(1, settings.drucker_anzahl || 2);
    const druckstundenProTag = Math.max(1, settings.druckstunden_pro_tag || 20);

    let totalOffeneSekunden = 0;
    for (const auftrag of offeneAuftraege ?? []) {
      for (const part of ((auftrag as Record<string, unknown>).parts as { slicer_druckzeit_sekunden: number | null }[]) ?? []) {
        totalOffeneSekunden += Number(part.slicer_druckzeit_sekunden) || 0;
      }
    }
    totalOffeneSekunden += neuerAuftragSekunden;

    const sekundenProTag = druckstundenProTag * 3600 * druckerAnzahl;
    const benoetigteTage = Math.ceil(totalOffeneSekunden / sekundenProTag);
    // +1 Werktag für Vorbereitung/Versand, min 1, max 14
    const werktage = Math.max(1, Math.min(benoetigteTage + 1, 14));

    const lieferdatum = new Date();
    let count = 0;
    while (count < werktage) {
      lieferdatum.setDate(lieferdatum.getDate() + 1);
      const day = lieferdatum.getDay();
      if (day !== 0 && day !== 6) count++;
    }

    return new Response(
      JSON.stringify({
        lieferdatum: lieferdatum.toISOString(),
        werktage,
        offene_stunden: Math.round(totalOffeneSekunden / 3600),
        offene_auftraege: offeneAuftraege?.length ?? 0,
        drucker_anzahl: druckerAnzahl,
        druckstunden_pro_tag: druckstundenProTag,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("calc-lieferzeit failed", err);
    return new Response(JSON.stringify({ error: "Lieferzeit-Berechnung fehlgeschlagen" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
