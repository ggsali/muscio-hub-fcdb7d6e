import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2";

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

    if (!customerId && name && email) {
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
    const { data: insertedInquiry, error } = await supabase
      .from("inquiries")
      .insert({
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
      })
      .select("id")
      .single();

    if (error) throw error;

    // Admin-Benachrichtigung per E-Mail direkt via Resend (Fehler hier nicht blockierend)
    try {
      const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);
      await resend.emails.send({
        from: "3DMuscio <noreply@3dmuscio.com>",
        to: ["anfrage@3dmuscio.com"],
        subject: `🔔 Neue Anfrage von ${name}${betreff ? ` – ${betreff}` : ""}`,
        html: `
          <div style="font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; color: #111827; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
            <div style="background: #FF5A00; padding: 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 600;">🔔 Neue Anfrage eingegangen</h1>
            </div>
            <div style="padding: 24px;">
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                <tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600; width: 120px;">Name</td><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">${name || "–"}</td></tr>
                <tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600;">E-Mail</td><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">${email || "–"}</td></tr>
                <tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Telefon</td><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">${telefon || "–"}</td></tr>
                <tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Betreff</td><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">${betreff || "–"}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: 600; vertical-align: top;">Nachricht</td><td style="padding: 8px 0;">${nachricht || "–"}</td></tr>
              </table>
              <div style="text-align: center;">
                <a href="https://muscio-hub.lovable.app/admin/anfragen" style="display: inline-block; background: #FF5A00; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 500;">Anfrage im Admin öffnen →</a>
              </div>
            </div>
            <div style="background: #f3f4f6; padding: 16px 24px; text-align: center; font-size: 12px; color: #6b7280;">
              3DMuscio · Eschlikon TG · anfrage@3dmuscio.com
            </div>
          </div>
        `,
      });
    } catch (mailErr) {
      console.error("Admin-Mail Fehler:", mailErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        inquiry_id: insertedInquiry?.id ?? null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Interner Fehler.", detail: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
