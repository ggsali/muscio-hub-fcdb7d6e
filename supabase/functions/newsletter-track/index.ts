// Öffentliches Newsletter-Tracking: Öffnungs-Pixel und Klick-Redirect.
// GET ?a=open&id=<empfaenger_id>  -> 1x1 GIF + Öffnung speichern
// GET ?a=click&id=<empfaenger_id>&url=<ziel> -> Klick speichern + 302 Redirect
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 1x1 transparentes GIF
const GIF = Uint8Array.from(
  atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"),
  (c) => c.charCodeAt(0),
);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FALLBACK_URL = "https://3dmuscio.com";

function pixel() {
  return new Response(GIF, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      "Content-Length": String(GIF.byteLength),
    },
  });
}

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const action = url.searchParams.get("a") ?? "open";
  const id = url.searchParams.get("id") ?? "";
  const target = url.searchParams.get("url") ?? "";

  if (action === "click") {
    const safeTarget = /^https?:\/\//i.test(target) ? target : FALLBACK_URL;
    try {
      if (UUID_RE.test(id)) {
        const db = admin();
        const { data: rec } = await db
          .from("newsletter_empfaenger")
          .select("id,newsletter_id")
          .eq("id", id)
          .maybeSingle();
        if (rec) {
          await db.from("newsletter_klicks").insert({
            newsletter_empfaenger_id: rec.id,
            newsletter_id: rec.newsletter_id,
            url: safeTarget.slice(0, 2000),
          });
        }
      }
    } catch (err) {
      console.error("Klick-Tracking Fehler:", err);
    }
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: safeTarget, "Cache-Control": "no-store" },
    });
  }

  try {
    if (UUID_RE.test(id)) {
      const db = admin();
      const { data: rec } = await db
        .from("newsletter_empfaenger")
        .select("id,newsletter_id,geoeffnet")
        .eq("id", id)
        .maybeSingle();

      if (rec && !rec.geoeffnet) {
        await db
          .from("newsletter_empfaenger")
          .update({ geoeffnet: true, geoeffnet_am: new Date().toISOString() })
          .eq("id", rec.id);

        if (rec.newsletter_id) {
          const { count } = await db
            .from("newsletter_empfaenger")
            .select("id", { count: "exact", head: true })
            .eq("newsletter_id", rec.newsletter_id)
            .eq("geoeffnet", true);
          await db
            .from("newsletters")
            .update({ geoeffnet_anzahl: count ?? 0 })
            .eq("id", rec.newsletter_id);
        }
      }
    }
  } catch (err) {
    console.error("Öffnungs-Tracking Fehler:", err);
  }

  return pixel();
});
