// Versendet einen Newsletter an eine Empfängerliste via Resend (nur Admins).
// Inklusive Öffnungs-Pixel und Klick-Tracking pro Empfänger.
import { Resend } from "npm:resend@2";
import { createClient } from "npm:@supabase/supabase-js@2";
import { renderNewsletter } from "../_shared/newsletter-template.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
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

    const body = await req.json().catch(() => ({}));
    const newsletterId = typeof body?.newsletter_id === "string" ? body.newsletter_id : "";
    const empfaenger = Array.isArray(body?.empfaenger) ? body.empfaenger : [];
    if (!newsletterId) return json({ error: "newsletter_id fehlt" }, 400);
    if (empfaenger.length === 0) return json({ error: "Keine Empfänger" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: nl, error: nlErr } = await admin
      .from("newsletters")
      .select("*")
      .eq("id", newsletterId)
      .maybeSingle();
    if (nlErr || !nl) return json({ error: "Newsletter nicht gefunden" }, 404);

    // Unterdrückte Adressen ausschliessen
    const { data: suppressed } = await admin.from("suppressed_emails").select("email");
    const blocked = new Set((suppressed ?? []).map((s: { email: string }) => s.email.toLowerCase()));

    const list = empfaenger
      .filter((r: { email?: string }) => typeof r?.email === "string" && /.+@.+\..+/.test(r.email))
      .filter((r: { email: string }) => !blocked.has(r.email.toLowerCase()));

    let sent = 0;
    const failed: string[] = [];

    for (const r of list) {
      // Empfänger-Zeile zuerst anlegen -> ID für Tracking
      const { data: rec } = await admin
        .from("newsletter_empfaenger")
        .insert({
          newsletter_id: newsletterId,
          customer_id: r.customer_id ?? null,
          email: r.email,
          name: r.name ?? null,
          gesendet: false,
        })
        .select("id")
        .single();

      const html = renderNewsletter({
        inhalt: nl.inhalt_text,
        name: r.name,
        email: r.email,
        bildUrl: nl.bild_url,
        blogUrl: nl.blog_link_url,
        blogTitel: nl.blog_link_titel,
        trackId: rec?.id ?? null,
      });

      const { error } = await resend.emails.send({
        from: "3DMuscio <noreply@3dmuscio.com>",
        to: [r.email],
        subject: nl.betreff,
        html,
      });

      const ok = !error;
      if (ok) sent++;
      else {
        failed.push(r.email);
        console.error("Resend Fehler für", r.email, error);
      }

      if (rec?.id) {
        await admin
          .from("newsletter_empfaenger")
          .update({ gesendet: ok, gesendet_am: ok ? new Date().toISOString() : null })
          .eq("id", rec.id);
      }

      await new Promise((res) => setTimeout(res, 120));
    }

    await admin
      .from("newsletters")
      .update({
        status: "gesendet",
        gesendet_am: new Date().toISOString(),
        empfaenger_anzahl: sent,
        inhalt_html: renderNewsletter({
          inhalt: nl.inhalt_text,
          name: "[Kundenname]",
          email: "beispiel@3dmuscio.com",
          bildUrl: nl.bild_url,
          blogUrl: nl.blog_link_url,
          blogTitel: nl.blog_link_titel,
        }),
      })
      .eq("id", newsletterId);

    return json({ success: true, sent, failed });
  } catch (err) {
    console.error("send-newsletter Fehler:", err);
    return json({ error: String(err) }, 500);
  }
});
