import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Adventskalender: liefert Türchen-Inhalte nur, wenn der Tag erreicht ist (Zeitzone Europe/Zurich).
// action "status": { jahr, heute, tage: [Tage mit Inhalt] }, action "open": { tag } -> { titel, text, code }
// Admins (gültiges Login) dürfen mit sim_tag einen Tag simulieren (Vorschau vor dem 1. Dezember).

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function zurichNow() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich", year: "numeric", month: "numeric", day: "numeric" })
    .formatToParts(new Date());
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: g("year"), m: g("month"), d: g("day") };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const action = body?.action === "open" ? "open" : "status";
    const now = zurichNow();
    const jahr = now.y;
    // Zählt ab 1.12.; davor 0; ab 25.12. sind alle Türchen offen (bis Jahresende)
    let heute = now.m === 12 ? Math.min(now.d, 24) : 0;

    // Admin-Vorschau
    const sim = Number(body?.sim_tag);
    if (sim >= 0 && sim <= 24 && Number.isInteger(sim)) {
      const auth = req.headers.get("authorization")?.replace("Bearer ", "");
      if (auth) {
        const { data: u } = await supabase.auth.getUser(auth);
        if (u?.user) {
          const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
          if (isAdmin) heute = sim;
        }
      }
    }

    if (action === "status") {
      const { data } = await supabase.from("advent_tuerchen").select("tag").eq("jahr", jahr);
      return json({ jahr, heute, tage: (data ?? []).map((r: any) => r.tag) });
    }

    const tag = Number(body?.tag);
    if (!Number.isInteger(tag) || tag < 1 || tag > 24) return json({ error: "Ungültiges Türchen" }, 400);
    if (tag > heute) return json({ error: "Dieses Türchen ist noch zu." }, 403);
    const { data } = await supabase.from("advent_tuerchen").select("titel,text,code,typ,wert").eq("jahr", jahr).eq("tag", tag).maybeSingle();
    if (!data) return json({ error: "Dieses Türchen ist noch leer." }, 404);
    return json(data);
  } catch (e) {
    return json({ error: "Fehler: " + (e as Error).message }, 500);
  }
});
