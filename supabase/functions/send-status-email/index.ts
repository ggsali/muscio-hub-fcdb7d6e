import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STATUS_KEY_MAP: Record<string, string> = {
  "Datei erhalten": "datei_erhalten",
  "Im Druck": "im_druck",
  "Qualitätsprüfung": "qualitaetspruefung",
  "Versandt": "versandt",
  "Geliefert": "geliefert",
  "datei_erhalten": "datei_erhalten",
  "im_druck": "im_druck",
  "qualitaetspruefung": "qualitaetspruefung",
  "versandt": "versandt",
  "geliefert": "geliefert",
};

function applyVars(text: string, vars: Record<string, string>) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

function nl2br(s: string) {
  return s.replace(/\n/g, "<br/>");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { order_id, status_key } = await req.json();
    if (!order_id || !status_key) {
      return new Response(JSON.stringify({ error: "order_id und status_key erforderlich" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const key = STATUS_KEY_MAP[status_key] || status_key;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY fehlt");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: tpl } = await supabase
      .from("email_templates").select("*").eq("status_key", key).maybeSingle();

    if (!tpl || !tpl.aktiv) {
      return new Response(JSON.stringify({ skipped: true, reason: "no-template-or-inactive" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: order } = await supabase
      .from("orders").select("*, customers(*)").eq("id", order_id).maybeSingle();

    const customer = (order as any)?.customers;
    if (!customer?.email) {
      return new Response(JSON.stringify({ skipped: true, reason: "no-email" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const vars = {
      vorname: customer.vorname || customer.name || "",
      name: customer.name || "",
      auftragsnummer: order.name || order.id.slice(0, 8),
      status: status_key,
    };

    const subject = applyVars(tpl.betreff, vars);
    const text = applyVars(tpl.nachricht, vars);
    const html = `<div style="font-family:Inter,Arial,sans-serif;color:#222;line-height:1.55;font-size:14px;max-width:600px;">${nl2br(text)}</div>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "3DMuscio <info@3dmuscio.com>",
        to: [customer.email],
        subject, html, text,
      }),
    });

    const body = await res.json();
    if (!res.ok) throw new Error(`Resend ${res.status}: ${JSON.stringify(body)}`);

    return new Response(JSON.stringify({ ok: true, id: body.id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
