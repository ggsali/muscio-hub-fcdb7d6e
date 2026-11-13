// Liest eine Adresse aus einem Bild (Foto/Screenshot) und gibt sie strukturiert zurück (nur Admins)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return json({ error: "Nicht autorisiert" }, 401);
    const authClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: u, error: ue } = await authClient.auth.getUser();
    if (ue || !u?.user) return json({ error: "Nicht autorisiert" }, 401);
    const { data: isAdmin } = await authClient.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Keine Berechtigung" }, 403);

    const body = await req.json().catch(() => ({}));
    const image = typeof body?.image === "string" ? body.image : "";
    if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(image)) return json({ error: "Ungültiges Bild" }, 400);
    if (image.length > 8_000_000) return json({ error: "Bild zu gross" }, 413);

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const prompt = `Lies die Empfängeradresse aus dem Bild. Das Bild kann ein Foto, Screenshot, Brief oder eine Bestellung sein und in jeder Sprache stehen.
Antworte NUR mit JSON in genau dieser Form, ohne Text drumherum:
{"name":"","firma":"","zusatz":"","strasse":"","plz":"","ort":"","region":"","land":"","telefon":""}
Regeln:
- name = Person, firma = Firma/Organisation (falls vorhanden), zusatz = c/o, Abteilung, Stockwerk o.ä.
- strasse = Strasse + Hausnummer in einer Zeile (bei US/UK etc. Hausnummer in der Reihenfolge wie im Land üblich), Postfach hier eintragen.
- region = Bundesstaat/Provinz/Kanton (z.B. CA, NSW, ON), nur wenn vorhanden.
- land = Landesname auf Deutsch (z.B. Schweiz, Deutschland, Vereinigte Staaten). Wenn kein Land erkennbar, leer lassen.
- Nichts erfinden. Unlesbares oder Fehlendes = leerer String. Zeichen und Akzente unverändert übernehmen.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: image } },
          ],
        }],
      }),
    });
    if (!res.ok) {
      console.error("AI error", res.status, await res.text());
      return json({ error: "Texterkennung fehlgeschlagen" }, 502);
    }
    const data = await res.json();
    const raw: string = data?.choices?.[0]?.message?.content || "";
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return json({ error: "Keine Adresse erkannt" }, 422);
    const p = JSON.parse(m[0]);
    const f = (k: string) => (typeof p[k] === "string" ? p[k].trim().slice(0, 120) : "");
    return json({
      adresse: {
        name: f("name"), firma: f("firma"), zusatz: f("zusatz"), strasse: f("strasse"),
        plz: f("plz"), ort: f("ort"), region: f("region"), land: f("land"), telefon: f("telefon"),
      },
    });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Fehler" }, 500);
  }
});
