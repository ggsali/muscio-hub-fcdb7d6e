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
    // Nur an einen einzelnen, im System erfassten Kunden senden
    const recipients = (Array.isArray(to) ? to : [to]).map((e: unknown) => String(e || "").trim().toLowerCase()).filter(Boolean);
    if (recipients.length !== 1 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipients[0])) {
      return new Response(JSON.stringify({ error: "Ungültiger Empfänger" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    {
      const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: known } = await db.from("customers").select("id").ilike("email", recipients[0]).limit(1);
      if (!known || known.length === 0) {
        return new Response(JSON.stringify({ error: "Empfänger ist kein erfasster Kunde" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    const b64Raw = String(pdfBase64).includes(",") ? String(pdfBase64).split(",")[1] : String(pdfBase64);
    if (b64Raw.length > 14_000_000 || !b64Raw.startsWith("JVBER")) {
      return new Response(JSON.stringify({ error: "Anhang muss ein PDF sein (max. 10 MB)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const b64 = b64Raw;
    const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const nr = String(rechnungsnummer).replace(/[^\w\-./]/g, "").slice(0, 40);
    const bt = String(betreff || "").replace(/[\r\n]/g, " ").slice(0, 150);
    const subject = `Rechnung ${nr}${bt ? ` – ${bt}` : ""}`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937;">
        <h2 style="margin:0 0 12px;">Rechnung ${esc(nr)}</h2>
        <p>Guten Tag ${esc(String(empfaenger_name || "").slice(0, 120))},</p>
        <p>im Anhang finden Sie unsere Rechnung als PDF.</p>
        ${bt ? `<p style="color:#6b7280;font-size:13px;">Betreff: ${esc(bt)}</p>` : ""}
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
