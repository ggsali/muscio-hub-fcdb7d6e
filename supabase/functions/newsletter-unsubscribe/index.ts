// Öffentliche Newsletter-Abmeldung: setzt customers.newsletter_aktiv = false.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || !/.+@.+\..+/.test(email) || email.length > 255) {
      return json({ error: "Ungültige E-Mail-Adresse" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error } = await admin
      .from("customers")
      .update({ newsletter_aktiv: false })
      .ilike("email", email);

    if (error) {
      console.error("Abmeldung fehlgeschlagen:", error);
      return json({ error: "Abmeldung fehlgeschlagen" }, 500);
    }

    return json({ success: true });
  } catch (err) {
    console.error("newsletter-unsubscribe Fehler:", err);
    return json({ error: String(err) }, 500);
  }
});
