import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, email, telefon, betreff, nachricht } = await req.json();

    if (!name || !email || !nachricht) {
      return new Response(JSON.stringify({ error: "Name, E-Mail und Nachricht sind erforderlich." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Prüfen ob Kunde bereits existiert
    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    let customerId: string | null = existingCustomer?.id ?? null;

    // Neuen Kunden NICHT automatisch anlegen — nur verknüpfen falls vorhanden.
    // (Konto-Erstellung wird auf der Website angeboten.)

    // Anfrage speichern
    const { error } = await supabase.from("inquiries").insert({
      name,
      email,
      telefon: telefon || null,
      betreff: betreff || "Anfrage",
      nachricht,
      quelle: "website",
      customer_id: customerId,
      status: "Neu",
    });

    if (error) throw error;

    // Admin-Benachrichtigung per E-Mail (Fehler hier blockieren die Anfrage nicht)
    try {
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const mailRes = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
        body: JSON.stringify({
          templateName: "neue-anfrage-admin",
          recipientEmail: "info@3dmuscio.com",
          idempotencyKey: `inquiry-admin-${crypto.randomUUID()}`,
          templateData: { name, email, telefon: telefon || null, betreff: betreff || "Anfrage", nachricht },
        }),
      });
      if (!mailRes.ok) {
        console.error("Admin-Mail Fehler:", mailRes.status, await mailRes.text());
      }
    } catch (mailErr) {
      console.error("Admin-Mail Fehler:", mailErr);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Interner Fehler." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
