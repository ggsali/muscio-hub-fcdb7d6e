const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ROOT_DOMAIN = "3dmuscio.com";

const isOpeningHours = (): boolean => {
  // Schweizer Zeit (UTC+1 Winter, UTC+2 Sommer)
  const now = new Date();
  const swissTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Zurich" }));
  const day = swissTime.getDay(); // 0=Sonntag, 1=Montag, 6=Samstag
  const hour = swissTime.getHours();
  const minute = swissTime.getMinutes();
  const time = hour * 60 + minute;

  const moFr = day >= 1 && day <= 5 && time >= 8 * 60 && time < 18 * 60;
  const sa = day === 6 && time >= 9 * 60 && time < 14 * 60;

  return moFr || sa;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { customerName, customerEmail, sessionId } = await req.json().catch(() => ({}));

    if (!isOpeningHours()) {
      return new Response(
        JSON.stringify({
          success: true,
          insideOpeningHours: false,
          message: "Ausserhalb Öffnungszeiten — keine Benachrichtigung gesendet",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chatLink = `https://${ROOT_DOMAIN}/admin/chat${sessionId ? `?session=${sessionId}` : ""}`;
    const html = `
      <h2>⚡ Live Chat Anfrage!</h2>
      <p><strong>Name:</strong> ${customerName || "Nicht angegeben"}</p>
      <p><strong>E-Mail:</strong> ${customerEmail || "Nicht angegeben"}</p>
      <p><strong>Zeitpunkt:</strong> ${new Date().toLocaleString("de-CH", { timeZone: "Europe/Zurich" })}</p>
      <p><a href="${chatLink}" style="display:inline-block;padding:10px 18px;background:#FF5A00;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">Zum Chat →</a></p>
    `;

    const resp = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: "3DMuscio Chat <noreply@3dmuscio.com>",
        to: ["info@3dmuscio.com"],
        subject: `🔔 Kunde möchte mit dir sprechen — ${customerName || "Unbekannt"}`,
        html,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(JSON.stringify({ error: "Email send failed", details: errText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, insideOpeningHours: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
