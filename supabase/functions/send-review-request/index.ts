// Sends a Google review request email to a customer directly via Resend.
import { Resend } from "npm:resend@2";
import { createClient } from "npm:@supabase/supabase-js@2";

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
    const { order_id, subject, body, customer_email, customer_name, review_url } = await req.json();

    if (!order_id || !customer_email || !body || !subject) {
      return new Response(
        JSON.stringify({ success: false, error: "Fehlende Felder" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Escape user text, then linkify the [Google Rezension schreiben] placeholder
    let html = esc(body).replace(/\n/g, "<br/>");
    if (review_url) {
      const safeUrl = esc(review_url);
      html = html.replace(
        /\[Google Rezension schreiben\]/g,
        `<a href="${safeUrl}" style="color:#FF5A00;font-weight:600;">Google Rezension schreiben</a>`,
      );
    }

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

    // Log in order_status_log via service role
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
