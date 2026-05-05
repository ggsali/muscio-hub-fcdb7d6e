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

const SITE_NAME = "3DMuscio";
const SENDER_DOMAIN = "notify.3dmuscio.com";
const FROM_EMAIL = `${SITE_NAME} <noreply@3dmuscio.com>`;
const REPLY_TO = "info@3dmuscio.com";

function applyVars(text: string, vars: Record<string, string>) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

function nl2br(s: string) {
  return s.replace(/\n/g, "<br/>");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ---- AUTH: require admin ----
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roleRow } = await supabase
      .from("user_roles").select("role")
      .eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { order_id, status_key } = await req.json();
    if (!order_id || !status_key) {
      return new Response(JSON.stringify({ error: "order_id und status_key erforderlich" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const key = STATUS_KEY_MAP[status_key] || status_key;


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

    const messageId = crypto.randomUUID();

    await supabase.from("email_send_log").insert({
      message_id: messageId,
      template_name: `status-${key}`,
      recipient_email: customer.email,
      status: "pending",
    });

    const { error: enqueueError } = await supabase.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        message_id: messageId,
        to: customer.email,
        from: FROM_EMAIL,
        reply_to: REPLY_TO,
        sender_domain: SENDER_DOMAIN,
        subject,
        html,
        text,
        purpose: "transactional",
        label: `status-${key}`,
        idempotency_key: `status-${order_id}-${key}-${Date.now()}`,
        queued_at: new Date().toISOString(),
      },
    });

    if (enqueueError) throw new Error(enqueueError.message);

    return new Response(JSON.stringify({ ok: true, queued: true, id: messageId }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
