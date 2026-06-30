// Public endpoint: sends admin notification email for a new website inquiry.
// Uses service role internally to authenticate against send-transactional-email.

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
        templateData: {
          name: name || "Unbekannt",
          email: email || "",
          telefon: telefon || null,
          betreff: betreff || "Anfrage",
          nachricht: nachricht || "",
        },
      }),
    });

    if (!mailRes.ok) {
      const txt = await mailRes.text();
      console.error("Admin-Mail Fehler:", mailRes.status, txt);
      return new Response(JSON.stringify({ success: false, error: txt }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-inquiry-admin Fehler:", err);
    return new Response(JSON.stringify({ success: false }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
