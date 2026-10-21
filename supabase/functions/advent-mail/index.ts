import { Resend } from "npm:resend@2";
import { createClient } from "npm:@supabase/supabase-js@2";
import { renderNewsletter } from "../_shared/newsletter-template.ts";

// Adventskalender-Mails.
//  action "send_code": Besucher bekommt den Code des heutigen Türchens per Mail (E-Mail wird als Kunde gespeichert,
//                      optional mit Einwilligung für die tägliche Erinnerung).
//  action "daily":     Tägliche Benachrichtigung "Türchen X ist offen" an alle Kunden mit aktivem Newsletter.
//                      Aufruf per Cron (Header x-automation-key) oder von einem Admin (Login); optional tag, test_email.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-automation-key",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);
const FROM = "3DMuscio <noreply@3dmuscio.com>";
const SITE = "https://3dmuscio.com";
const MAX_DAILY_PER_RUN = 400;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

const ALLOWED_ORIGIN = /^https:\/\/((www\.)?3dmuscio\.com|[a-z0-9-]+\.lovable\.app|[a-z0-9-]+\.lovableproject\.com)$|^http:\/\/localhost(:\d+)?$/;

function zurichNow() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich", year: "numeric", month: "numeric", day: "numeric" })
    .formatToParts(new Date());
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: g("year"), m: g("month"), d: g("day") };
}

function rateLimited(req: Request): boolean {
  const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const now = Date.now();
  // @ts-ignore globalThis cache
  const store: Map<string, number[]> = (globalThis.__adventRate ||= new Map());
  const hits = (store.get(ip) || []).filter((t: number) => now - t < 10 * 60_000);
  if (hits.length >= 8) return true;
  hits.push(now);
  store.set(ip, hits);
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const now = zurichNow();
    const jahr = now.y;
    const heute = now.m === 12 ? Math.min(now.d, 24) : 0;

    if (body?.action === "send_code") {
      if (!ALLOWED_ORIGIN.test(req.headers.get("origin") || "")) return json({ error: "Nicht erlaubt" }, 403);
      if (rateLimited(req)) return json({ error: "Zu viele Anfragen. Bitte später erneut versuchen." }, 429);
      const tag = Number(body?.tag);
      const email = String(body?.email ?? "").trim().toLowerCase().slice(0, 200);
      const consent = body?.consent === true;
      if (!Number.isInteger(tag) || tag < 1 || tag > 24) return json({ error: "Ungültiges Türchen" }, 400);
      if (!EMAIL_RE.test(email)) return json({ error: "Bitte gültige E-Mail-Adresse eingeben." }, 400);
      // Admin (Login) darf zum Testen jedes Türchen mailen; alle anderen nur bereits offene Türchen
      let adminTest = false;
      const tok = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
      if (tok) {
        const { data: u } = await admin.auth.getUser(tok);
        if (u?.user) {
          const { data: ok } = await admin.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
          adminTest = ok === true;
        }
      }
      if (tag > heute && !adminTest) return json({ error: "Dieses Türchen ist noch zu." }, 403);

      const { data: door } = await admin.from("advent_tuerchen").select("titel,text,code").eq("jahr", jahr).eq("tag", tag).maybeSingle();
      if (!door || !door.code) return json({ error: "Zu diesem Türchen gibt es keinen Code." }, 404);

      const { data: suppressed } = await admin.from("suppressed_emails").select("email").eq("email", email).maybeSingle();
      if (suppressed) return json({ error: "An diese Adresse können wir leider keine E-Mails senden." }, 400);

      // Als Kunde speichern (bestehende Kunden nur bei Einwilligung auf Newsletter aktiv setzen)
      const { data: existing } = await admin.from("customers").select("id,newsletter_aktiv").eq("email", email).maybeSingle();
      if (!existing) {
        const local = email.split("@")[0].replace(/[._-]+/g, " ").trim() || "Adventskalender";
        await admin.from("customers").insert({
          name: local, vorname: "", email, land: "Schweiz",
          newsletter_aktiv: consent,
          notizen: `Adventskalender ${jahr}${consent ? " (tägliche Erinnerung gewünscht)" : ""}`,
        });
      } else if (consent && existing.newsletter_aktiv === false) {
        await admin.from("customers").update({ newsletter_aktiv: true }).eq("id", existing.id);
      }

      // Nur einmal pro Adresse und Türchen senden
      const { error: logErr } = adminTest ? { error: null } : await admin.from("advent_versand_log").insert({ jahr, tag, email, art: "code" });
      if (logErr) return json({ ok: true, already: true });

      const inhalt =
        `Frohe Adventszeit!\n\nHinter Türchen ${tag} wartet auf dich: ${door.titel}\n\n` +
        (door.text ? `${door.text}\n\n` : "") +
        `Dein Code: ${door.code}\n\nLöse ihn im Online-Kalkulator oder im Shop-Warenkorb im Feld "Gutschein-Code" ein. Er gilt nur am ${tag}. Dezember.\n\n` +
        `${SITE}/kalkulator-online\n\nSchöne Adventszeit wünscht dein 3DMuscio-Team`;
      const html = renderNewsletter({ inhalt, name: null, email, trackId: null });
      const { error } = await resend.emails.send({
        from: FROM, to: [email], subject: `🎁 Dein Code von Türchen ${tag}: ${door.titel}`, html,
      });
      if (error) {
        if (!adminTest) await admin.from("advent_versand_log").delete().eq("jahr", jahr).eq("tag", tag).eq("email", email).eq("art", "code");
        console.error("advent send_code Resend-Fehler", error);
        return json({ error: "E-Mail konnte nicht gesendet werden." }, 502);
      }
      return json({ ok: true });
    }

    if (body?.action === "daily") {
      // Autorisierung: Cron-Key oder Admin-Login
      let authorized = false;
      let isAdmin = false;
      const cronKey = req.headers.get("x-automation-key") ?? "";
      if (cronKey) {
        const envKey = Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "";
        if (envKey && cronKey === envKey) authorized = true;
        if (!authorized) {
          const { data: setting } = await admin.from("settings").select("value").eq("key", "newsletter_cron_key").maybeSingle();
          if (setting?.value && setting.value === cronKey) authorized = true;
        }
      }
      if (!authorized) {
        const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
        if (!token) return json({ error: "Nicht angemeldet" }, 401);
        const { data: u } = await admin.auth.getUser(token);
        if (!u?.user) return json({ error: "Nicht angemeldet" }, 401);
        const { data: ok } = await admin.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
        if (!ok) return json({ error: "Kein Zugriff" }, 403);
        authorized = true;
        isAdmin = true;
      }

      let tag = heute;
      if (isAdmin && Number.isInteger(Number(body?.tag)) && Number(body.tag) >= 1 && Number(body.tag) <= 24) tag = Number(body.tag);
      const testEmail = isAdmin ? String(body?.test_email ?? "").trim().toLowerCase() : "";
      if (tag < 1) return json({ ok: true, skipped: "Kein Adventstag" });

      const { data: door } = await admin.from("advent_tuerchen").select("titel,code").eq("jahr", jahr).eq("tag", tag).maybeSingle();
      if (!door) return json({ ok: true, skipped: `Türchen ${tag} ist leer` });

      let recipients: { email: string; name: string | null }[] = [];
      if (testEmail) {
        if (!EMAIL_RE.test(testEmail)) return json({ error: "Ungültige Test-Adresse" }, 400);
        recipients = [{ email: testEmail, name: null }];
      } else {
        const { data: suppressed } = await admin.from("suppressed_emails").select("email");
        const blocked = new Set((suppressed ?? []).map((s: { email: string }) => s.email.toLowerCase()));
        const { data: done } = await admin.from("advent_versand_log").select("email").eq("jahr", jahr).eq("tag", tag).eq("art", "daily");
        const already = new Set((done ?? []).map((d: { email: string }) => d.email.toLowerCase()));
        const { data: customers } = await admin
          .from("customers").select("vorname,name,email").eq("newsletter_aktiv", true).not("email", "is", null);
        const seen = new Set<string>();
        for (const c of customers ?? []) {
          const em = String(c.email ?? "").trim().toLowerCase();
          if (!EMAIL_RE.test(em) || blocked.has(em) || already.has(em) || seen.has(em)) continue;
          seen.add(em);
          recipients.push({ email: em, name: [c.vorname, c.name].filter(Boolean).join(" ").trim() || null });
        }
      }

      let sent = 0, failed = 0;
      const batch = recipients.slice(0, MAX_DAILY_PER_RUN);
      for (const r of batch) {
        const inhalt =
          `Hallo [Kundenname]\n\nTürchen ${tag} im 3DMuscio-Adventskalender ist offen!\n\n` +
          `Heute wartet auf dich: ${door.titel}\n\nÖffne das Türchen auf unserer Startseite:\n${SITE}/\n\n` +
          `Schöne Adventszeit wünscht dein 3DMuscio-Team`;
        const html = renderNewsletter({ inhalt, name: r.name, email: r.email, trackId: null });
        const { error } = await resend.emails.send({
          from: FROM, to: [r.email], subject: `🎄 Türchen ${tag} ist offen: ${door.titel}`, html,
        });
        if (error) { failed++; console.error("advent daily Resend-Fehler", error); }
        else {
          sent++;
          if (!testEmail) await admin.from("advent_versand_log").upsert({ jahr, tag, email: r.email, art: "daily" });
        }
        await new Promise((res) => setTimeout(res, 150));
      }
      return json({ ok: true, tag, sent, failed, remaining: Math.max(0, recipients.length - batch.length) });
    }

    return json({ error: "Unbekannte Aktion" }, 400);
  } catch (e) {
    console.error("advent-mail Fehler", e);
    return json({ error: "Fehler: " + (e as Error).message }, 500);
  }
});
