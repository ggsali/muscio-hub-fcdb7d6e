import { Resend } from "npm:resend@4.0.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FROM_EMAIL = "3DMuscio <noreply@3dmuscio.com>";
const REPLY_TO = "info@3dmuscio.com";
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { to, rechnungsnummer, empfaenger_name, betreff, pdfBase64, pdfFilename } = await req.json();
    if (!to || !pdfBase64 || !rechnungsnummer) {
      return new Response(JSON.stringify({ error: "missing fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const b64 = String(pdfBase64).includes(",") ? String(pdfBase64).split(",")[1] : String(pdfBase64);
    const subject = `Rechnung ${rechnungsnummer}${betreff ? ` – ${betreff}` : ""}`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937;">
        <h2 style="margin:0 0 12px;">Rechnung ${rechnungsnummer}</h2>
        <p>Guten Tag ${empfaenger_name || ""},</p>
        <p>im Anhang finden Sie unsere Rechnung als PDF.</p>
        ${betreff ? `<p style="color:#6b7280;font-size:13px;">Betreff: ${betreff}</p>` : ""}
        <p>Bei Fragen sind wir jederzeit gerne für Sie da.</p>
        <p>Freundliche Grüsse<br><strong>3DMuscio</strong></p>
      </div>`;

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: Array.isArray(to) ? to : [to],
      reply_to: REPLY_TO,
      subject,
      html,
      attachments: [{ filename: pdfFilename || `Rechnung_${rechnungsnummer}.pdf`, content: b64 }],
    } as any);

    if (error) {
      return new Response(JSON.stringify({ error: String((error as any).message || error) }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ success: true, id: (data as any)?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
