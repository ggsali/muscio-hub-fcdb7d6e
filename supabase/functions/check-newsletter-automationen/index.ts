// Cron: täglich um 09:00 Uhr Schweizer Zeit (08:00 UTC)
// Prüft Newsletter-Automationen und versendet fällige Mails (Reaktivierung / Follow-up).
// Aufruf: manuell aus dem Admin-Bereich (Admin-JWT) oder per Cron mit Header x-automation-key.
import { Resend } from "npm:resend@2";
import { createClient } from "npm:@supabase/supabase-js@2";
import { renderNewsletter } from "../_shared/newsletter-template.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-automation-key",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const MAX_PER_RUN = 50;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const cronKey = req.headers.get("x-automation-key") ?? "";
    let authorized = false;
    if (cronKey.length > 0) {
      const envKey = Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "";
      if (envKey.length > 0 && cronKey === envKey) authorized = true;
      if (!authorized) {
        const { data: setting } = await admin
          .from("settings").select("value").eq("key", "newsletter_cron_key").maybeSingle();
        if (setting?.value && setting.value === cronKey) authorized = true;
      }
    }

    if (!authorized) {
      const authHeader = req.headers.get("Authorization") ?? "";
      if (!authHeader) return json({ error: "Nicht angemeldet" }, 401);
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: userData } = await userClient.auth.getUser();
      const user = userData?.user;
      if (!user) return json({ error: "Nicht angemeldet" }, 401);
      const { data: isAdmin } = await userClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!isAdmin) return json({ error: "Kein Zugriff" }, 403);
      authorized = true;
    }


    const body = await req.json().catch(() => ({}));
    const onlyId = typeof body?.automation_id === "string" ? body.automation_id : null;

    let q = admin.from("newsletter_automationen").select("*");
    if (onlyId) q = q.eq("id", onlyId);
    else q = q.eq("aktiv", true);
    const { data: automationen } = await q;

    const { data: suppressed } = await admin.from("suppressed_emails").select("email");
    const blocked = new Set((suppressed ?? []).map((s: { email: string }) => s.email.toLowerCase()));

    const { data: customers } = await admin
      .from("customers")
      .select("id,name,vorname,email,newsletter_aktiv")
      .eq("newsletter_aktiv", true)
      .not("email", "is", null);

    const { data: orders } = await admin.from("orders").select("customer_id,created_at");
    const { data: logs } = await admin
      .from("newsletter_automation_log")
      .select("automation_id,customer_id,gesendet_am");

    const ordersByCustomer = new Map<string, string[]>();
    for (const o of orders ?? []) {
      if (!o.customer_id) continue;
      const arr = ordersByCustomer.get(o.customer_id) ?? [];
      arr.push(o.created_at as string);
      ordersByCustomer.set(o.customer_id, arr);
    }

    const results: Record<string, { sent: number; skipped: number }> = {};

    for (const a of automationen ?? []) {
      const days = Math.max(1, a.tage_verzoegerung ?? 90);
      const cutoff = Date.now() - days * 86400_000;
      let sent = 0;
      let skipped = 0;

      const candidates = (customers ?? []).filter((c) => {
        const email = String(c.email ?? "").toLowerCase();
        if (!email || blocked.has(email)) return false;

        const dates = (ordersByCustomer.get(c.id) ?? []).map((d) => new Date(d).getTime()).sort((x, y) => x - y);

        if (a.typ === "reaktivierung") {
          // Kein Auftrag in den letzten X Tagen
          if (dates.some((d) => d > cutoff)) return false;
        } else if (a.typ === "nach_erstem_auftrag") {
          // Genau ein Auftrag, älter als X Tage
          if (dates.length !== 1) return false;
          if (dates[0] > cutoff) return false;
        } else {
          return false;
        }

        // Nicht erneut innerhalb des Zeitfensters senden
        const already = (logs ?? []).some(
          (l) =>
            l.automation_id === a.id &&
            l.customer_id === c.id &&
            new Date(l.gesendet_am as string).getTime() > cutoff,
        );
        return !already;
      });

      for (const c of candidates.slice(0, MAX_PER_RUN)) {
        const name = [c.vorname, c.name].filter(Boolean).join(" ").trim() || null;
        const html = renderNewsletter({
          inhalt: a.inhalt_vorlage ?? "",
          name,
          email: c.email as string,
          trackId: null,
        });

        const { error } = await resend.emails.send({
          from: "3DMuscio <noreply@3dmuscio.com>",
          to: [c.email as string],
          subject: a.betreff_vorlage ?? "3DMuscio",
          html,
        });

        if (error) {
          console.error("Automation Resend Fehler:", c.email, error);
          skipped++;
        } else {
          sent++;
          await admin.from("newsletter_automation_log").insert({
            automation_id: a.id,
            customer_id: c.id,
          });
        }
        await new Promise((res) => setTimeout(res, 150));
      }

      results[a.typ] = { sent, skipped };
      if (candidates.length > MAX_PER_RUN) {
        console.log(`Automation ${a.typ}: ${candidates.length - MAX_PER_RUN} Kunden auf nächsten Lauf verschoben`);
      }
    }

    return json({ success: true, results });
  } catch (err) {
    console.error("check-newsletter-automationen Fehler:", err);
    return json({ error: String(err) }, 500);
  }
});
