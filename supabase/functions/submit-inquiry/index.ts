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
    const {
      name, email, telefon, betreff, nachricht,
      strasse, plz, ort, land,
      attachments,
      ki_beratung_zusammenfassung,
      ki_empfohlenes_material,
    } = await req.json();

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
      .select("id, strasse, plz, ort")
      .eq("email", email)
      .maybeSingle();

    let customerId: string | null = existingCustomer?.id ?? null;

    if (!customerId && strasse && plz && ort) {
      // Neuen Kunden anlegen
      const nameParts = name.trim().split(" ");
      const vorname = nameParts[0] || "";
      const nachname = nameParts.slice(1).join(" ") || vorname;

      const { data: newCustomer } = await supabase.from("customers").insert({
        name: nachname,
        vorname,
        email,
        telefon: telefon || null,
        strasse: strasse || null,
        plz: plz || null,
        ort: ort || null,
        land: land || "Schweiz",
        notizen: "Automatisch aus Anfrage erstellt",
      }).select("id").single();

      if (newCustomer) customerId = newCustomer.id;
    } else if (customerId && (strasse || plz || ort)) {
      // Adresse im bestehenden Kundenprofil ergänzen falls noch leer
      if (!existingCustomer?.strasse && strasse) {
        await supabase.from("customers").update({
          strasse: strasse || null,
          plz: plz || null,
          ort: ort || null,
          land: land || "Schweiz",
        }).eq("id", customerId);
      }
    }

    // Anfrage speichern
    const { data: inserted, error } = await supabase.from("inquiries").insert({
      name,
      email,
      telefon: telefon || null,
      betreff: betreff || "Anfrage",
      nachricht,
      quelle: "website",
      customer_id: customerId,
      status: "Neu",
      attachments: attachments || null,
      ki_beratung_zusammenfassung: ki_beratung_zusammenfassung || null,
      ki_empfohlenes_material: ki_empfohlenes_material || null,
    }).select("id").single();

    if (error) throw error;

    // Admin-Benachrichtigung per E-Mail (Fehler hier nicht blockierend)
    try {
      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "neue-anfrage-admin",
          recipientEmail: "anfrage@3dmuscio.com",
          idempotencyKey: `inquiry-admin-${crypto.randomUUID()}`,
          templateData: { name, email, telefon: telefon || null, betreff: betreff || "Anfrage", nachricht },
        },
      });
    } catch (mailErr) {
      console.error("Admin-Mail Fehler:", mailErr);
    }

    return new Response(JSON.stringify({ success: true, customerId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Interner Fehler.", detail: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
