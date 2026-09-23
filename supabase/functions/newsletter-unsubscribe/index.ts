// Öffentliche Newsletter-Abmeldung: setzt customers.newsletter_aktiv = false.
// Erfordert ein signiertes Token aus dem Abmelde-Link der E-Mail.
import { createClient } from "npm:@supabase/supabase-js@2";
import { normalizeEmail, verifyUnsubToken } from "../_shared/newsletter-unsub.ts";

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
    const email = normalizeEmail(typeof body?.email === "string" ? body.email : "");
    const token = typeof body?.token === "string" ? body.token.trim() : "";

    if (!email || !/.+@.+\..+/.test(email) || email.length > 255) {
      return json({ error: "Ungültige E-Mail-Adresse" }, 400);
    }

    // Ownership-Nachweis: nur mit gültigem Token aus dem Abmelde-Link.
    if (!verifyUnsubToken(email, token)) {
      return json({ error: "Ungültiger oder abgelaufener Abmelde-Link" }, 403);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Wildcards escapen, damit nur exakt diese (verifizierte) Adresse getroffen wird
    const exactPattern = email.replace(/[\\%_]/g, (c) => `\\${c}`);
    const { error } = await admin
      .from("customers")
      .update({ newsletter_aktiv: false })
      .ilike("email", exactPattern);

    if (error) {
      console.error("Abmeldung fehlgeschlagen:", error);
      return json({ error: "Abmeldung fehlgeschlagen" }, 500);
    }

    return json({ success: true });
  } catch (err) {
    console.error("newsletter-unsubscribe Fehler:", err);
    return json({ error: "Abmeldung fehlgeschlagen" }, 500);
  }
});
