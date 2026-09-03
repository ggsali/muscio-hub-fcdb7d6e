// Sends a Google review request email to a customer directly via Resend.
// Uses the same branded layout as all other 3DMuscio e-mails
// (logo header, heading, green CTA button, divider + footer).
import { Resend } from "npm:resend@2";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_NAME = "3DMuscio";
const SITE_URL = "https://3dmuscio.com";
const LOGO_URL =
  "https://ukqtjdsjmtxgzhklvqky.supabase.co/storage/v1/object/public/company-assets/logo.jpeg";

const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);

function esc(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const BUTTON_PLACEHOLDER = /\[Google Rezension schreiben\]/g;

/** Wraps the editable body text in the shared brand layout. */
function renderEmail(opts: { bodyText: string; reviewUrl: string; heading: string }) {
  const { bodyText, reviewUrl, heading } = opts;

  // Split editable text into paragraphs; the button placeholder becomes a real CTA.
  const blocks = bodyText.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const parts: string[] = [];

  for (const block of blocks) {
    if (BUTTON_PLACEHOLDER.test(block)) {
      BUTTON_PLACEHOLDER.lastIndex = 0;
      const rest = block.replace(BUTTON_PLACEHOLDER, "").replace(/^[\s👉>-]+/u, "").trim();
      if (reviewUrl) {
        parts.push(
          `<div style="margin:28px 0;text-align:center;"><a href="${esc(reviewUrl)}" style="background-color:#00cc66;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;display:inline-block;">⭐ Google Rezension schreiben</a></div>`,
        );
      }
      if (rest) {
        parts.push(
          `<p style="font-size:14px;line-height:1.6;color:#3f3f46;margin:0 0 14px;">${esc(rest).replace(/\n/g, "<br/>")}</p>`,
        );
      }
      continue;
    }
    parts.push(
      `<p style="font-size:14px;line-height:1.6;color:#3f3f46;margin:0 0 14px;">${esc(block).replace(/\n/g, "<br/>")}</p>`,
    );
  }

  return `<!DOCTYPE html>
<html lang="de" dir="ltr">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
  <body style="background-color:#f5f5f5;font-family:Inter,Arial,sans-serif;margin:0;padding:0;color:#1a1a1a;">
    <div style="max-width:600px;margin:0 auto;padding:24px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background:#18181b;padding:20px 28px;border-radius:12px 12px 0 0;width:100%;border-collapse:separate;">
        <tr>
          <td width="44" style="vertical-align:middle;padding-right:12px;">
            <img src="${LOGO_URL}" alt="${SITE_NAME}" width="44" height="44" style="border-radius:8px;display:block;" />
          </td>
          <td style="vertical-align:middle;font-size:20px;font-weight:700;color:#ffffff;line-height:44px;">${SITE_NAME}</td>
        </tr>
      </table>

      <div style="background:#ffffff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;line-height:1.6;font-size:14px;">
      <h1 style="font-size:24px;font-weight:700;color:#18181b;margin:0 0 16px;">${esc(heading)}</h1>

      ${parts.join("\n      ")}

      <hr style="border:none;border-top:1px solid #e4e4e7;margin:28px 0 16px;" />
      <p style="font-size:12px;color:#71717a;margin:0;text-align:center;">
        Bei Fragen erreichst du uns unter
        <a href="mailto:info@3dmuscio.com" style="color:#00cc66;text-decoration:none;">info@3dmuscio.com</a>
        ·
        <a href="${SITE_URL}" style="color:#00cc66;text-decoration:none;">3dmuscio.com</a>
      </p>
      </div>
    </div>
  </body>
</html>`;
}


/** Verifies the caller is an authenticated admin. Returns null when allowed, else a Response. */
async function requireAdmin(req: Request, corsHeaders: Record<string, string>): Promise<Response | null> {
  const authHeader = req.headers.get("Authorization") || "";
  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await client.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
  if (!roles?.some((r: any) => r.role === "admin")) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const denied = await requireAdmin(req, corsHeaders);
    if (denied) return denied;

    const { order_id, subject, body, customer_email, customer_name, review_url } = await req.json();

    if (!order_id || !customer_email || !body || !subject) {
      return new Response(
        JSON.stringify({ success: false, error: "Fehlende Felder" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const html = renderEmail({
      bodyText: String(body),
      reviewUrl: String(review_url || ""),
      heading: "Wie war dein 3D-Druck Erlebnis? ⭐",
    });

    const { error } = await resend.emails.send({
      from: "3DMuscio <noreply@3dmuscio.com>",
      to: [customer_email],
      subject,
      html,
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
