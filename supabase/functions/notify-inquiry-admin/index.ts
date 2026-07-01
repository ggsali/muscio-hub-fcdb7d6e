// Public endpoint: sends admin notification email for a new website inquiry via Resend directly.
import { Resend } from "npm:resend@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);

function esc(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, email, telefon, betreff, nachricht } = await req.json();

    const safeName = esc(name || "Unbekannt");
    const safeEmail = esc(email || "");
    const safeTel = esc(telefon || "–");
    const safeBetreff = esc(betreff || "Anfrage");
    const safeNachricht = esc(nachricht || "").replace(/\n/g, "<br/>");

    const { error } = await resend.emails.send({
      from: "3DMuscio <noreply@3dmuscio.com>",
      to: ["anfrage@3dmuscio.com"],
      reply_to: email || undefined,
      subject: `Neue Anfrage von ${safeName} – ${safeBetreff}`,
      html: `
        <h2>Neue Anfrage eingegangen</h2>
        <p><strong>Name:</strong> ${safeName}</p>
        <p><strong>E-Mail:</strong> ${safeEmail}</p>
        <p><strong>Telefon:</strong> ${safeTel}</p>
        <p><strong>Betreff:</strong> ${safeBetreff}</p>
        <p><strong>Nachricht:</strong></p>
        <p>${safeNachricht}</p>
        <hr/>
        <p style="color:#888;font-size:12px;">Gesendet über 3dmuscio.com</p>
      `,
    });

    if (error) {
      console.error("Resend Fehler:", error);
      return new Response(JSON.stringify({ success: false, error: String(error) }), {
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
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
