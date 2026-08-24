import { Resend } from "npm:resend@4.0.1";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FROM_EMAIL = "3DMuscio <noreply@3dmuscio.com>";
const REPLY_TO = "info@3dmuscio.com";
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));


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
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const denied = await requireAdmin(req, corsHeaders);
    if (denied) return denied;

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
