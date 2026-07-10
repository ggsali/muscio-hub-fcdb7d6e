// Sends a Google review request email to a customer directly via Resend.
import { Resend } from "npm:resend@2";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { order_id, subject, body, customer_email, customer_name } = await req.json();

    if (!order_id || !customer_email || !body || !subject) {
      return new Response(
        JSON.stringify({ success: false, error: "Fehlende Felder (order_id, subject, body, customer_email)" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Convert plain-text body to HTML (preserve line breaks, keep any embedded links)
    const html = String(body)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      // restore anchor tags we intentionally embed as HTML from the client
      .replace(/&lt;a /g, "<a ")
      .replace(/&lt;\/a&gt;/g, "</a>")
      .replace(/"&gt;/g, '">')
      .replace(/\n/g, "<br/>");

    const { error } = await resend.emails.send({
      from: "3DMuscio <noreply@3dmuscio.com>",
      to: [customer_email],
      subject,
      html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#222;">${html}</div>`,
    });

    if (error) {
      console.error("Resend Fehler:", error);
      return new Response(JSON.stringify({ success: false, error: String(error) }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log in order_status_log (service role)
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      await supabase.from("order_status_log").insert({
        order_id,
        status: "review_request",
        notiz: `Rezensions-Anfrage per E-Mail gesendet an ${customer_name || customer_email}`,
      });
    } catch (e) {
      console.error("order_status_log insert failed", e);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-review-request Fehler:", err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
