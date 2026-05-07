import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.0.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FROM_EMAIL = "3DMuscio <noreply@3dmuscio.com>";
const REPLY_TO = "info@3dmuscio.com";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const STATUS_KEY_MAP: Record<string, string> = {
  "Datei erhalten": "datei_erhalten",
  "Im Druck": "im_druck",
  "Qualitätsprüfung": "qualitaetspruefung",
  "Versandt": "versandt",
  "Geliefert": "geliefert",
  datei_erhalten: "datei_erhalten",
  im_druck: "im_druck",
  qualitaetspruefung: "qualitaetspruefung",
  versandt: "versandt",
  geliefert: "geliefert",
};

const STATUS_TEXTS: Record<string, { subject: string; title: string; intro: string; emoji: string }> = {
  datei_erhalten: {
    subject: "Wir haben Ihre Datei erhalten",
    title: "Datei erhalten",
    intro: "wir haben Ihre Druckdaten erfolgreich erhalten und prüfen diese nun.",
    emoji: "📥",
  },
  im_druck: {
    subject: "Ihr Auftrag ist im Druck",
    title: "Im Druck",
    intro: "Ihr Auftrag befindet sich aktuell im 3D-Druck.",
    emoji: "🖨️",
  },
  qualitaetspruefung: {
    subject: "Ihr Auftrag in der Qualitätsprüfung",
    title: "Qualitätsprüfung",
    intro: "Ihr Auftrag wurde gedruckt und befindet sich nun in der Qualitätsprüfung.",
    emoji: "🔍",
  },
  versandt: {
    subject: "Ihr Auftrag wurde versandt",
    title: "Versandt",
    intro: "Ihr Auftrag ist auf dem Weg zu Ihnen.",
    emoji: "📦",
  },
  geliefert: {
    subject: "Ihr Auftrag wurde geliefert",
    title: "Geliefert",
    intro: "Ihr Auftrag wurde erfolgreich geliefert. Wir wünschen viel Freude!",
    emoji: "✅",
  },
};

function emailLayout({ title, bodyHtml }: { title: string; bodyHtml: string }) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;color:#1a1a1a;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#18181b;padding:24px 32px;border-radius:12px 12px 0 0;display:flex;align-items:center;gap:14px;">
      <img src="https://ukqtjdsjmtxgzhklvqky.supabase.co/storage/v1/object/public/company-assets/logo.jpeg" alt="3DMuscio" width="44" height="44" style="border-radius:8px;display:block;" />
      <span style="color:#ffffff;font-size:20px;font-weight:700;">3DMuscio</span>
    </div>
    <div style="background:#ffffff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;line-height:1.6;font-size:14px;">
      <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#000;">${title}</h1>
      ${bodyHtml}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 16px;" />
      <div style="text-align:center;font-size:12px;color:#9ca3af;">
        <a href="mailto:info@3dmuscio.com" style="color:#22c55e;text-decoration:none;">info@3dmuscio.com</a>
        &nbsp;·&nbsp; +41 79 839 50 80 &nbsp;·&nbsp;
        <a href="https://3dmuscio.com" style="color:#22c55e;text-decoration:none;">3dmuscio.com</a>
      </div>
    </div>
  </div>
</body></html>`;
}

function buildOrderEmail(opts: {
  type: string;
  customerName: string;
  orderNr: string;
  orderName: string;
  datum: string;
  paymentUrl?: string | null;
  trackingNr?: string | null;
  akontoPercent?: number | null;
  akontoBetrag?: number | null;
  restbetrag?: number | null;
}): { subject: string; html: string } {
  const { type, customerName, orderNr, orderName, datum, paymentUrl, trackingNr, akontoPercent, akontoBetrag, restbetrag } = opts;

  const greet = `<p>Guten Tag ${customerName},</p>`;

  const paymentBtn = paymentUrl
    ? `<div style="margin:24px 0;text-align:center;">
        <a href="${paymentUrl}" style="display:inline-block;background:#22c55e;color:#fff;font-weight:700;padding:14px 32px;border-radius:8px;text-decoration:none;">💳 Jetzt online bezahlen</a>
        <p style="margin:8px 0 0;font-size:12px;color:#6b7280;">Sichere Zahlung via Stripe</p>
      </div>`
    : "";

  if (type === "rechnung") {
    return {
      subject: `Rechnung ${orderNr} – 3DMuscio`,
      html: emailLayout({
        title: "Ihre Rechnung",
        bodyHtml: `${greet}<p>vielen Dank für Ihren Auftrag. Im Anhang finden Sie Ihre Rechnung <strong>Nr. ${orderNr}</strong> vom ${datum}.</p>${paymentBtn}<p>Mit freundlichen Grüssen<br><strong>3DMuscio</strong></p>`,
      }),
    };
  }
  if (type === "offerte") {
    return {
      subject: `Offerte ${orderNr} – 3DMuscio`,
      html: emailLayout({
        title: "Ihre Offerte",
        bodyHtml: `${greet}<p>gerne unterbreiten wir Ihnen unser Angebot. Im Anhang finden Sie die Offerte vom ${datum}.</p><p>Für Rückfragen stehen wir Ihnen gerne zur Verfügung.</p><p>Mit freundlichen Grüssen<br><strong>3DMuscio</strong></p>`,
      }),
    };
  }
  if (type === "akonto") {
    const ak = akontoBetrag != null ? `CHF ${Number(akontoBetrag).toFixed(2)}` : "";
    return {
      subject: `Akontorechnung – 3DMuscio`,
      html: emailLayout({
        title: "Akontorechnung",
        bodyHtml: `${greet}<p>anbei erhalten Sie unsere Akontorechnung für den Auftrag „${orderName}".</p>${ak ? `<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:16px 20px;margin:20px 0;"><p style="margin:0 0 4px;font-size:12px;color:#22c55e;font-weight:700;text-transform:uppercase;">Akontozahlung (${akontoPercent}%)</p><p style="margin:0;font-size:22px;font-weight:700;">${ak}</p></div>` : ""}<p>Die vollständige Akontorechnung finden Sie im Anhang als PDF.</p><p>Mit freundlichen Grüssen<br><strong>3DMuscio</strong></p>`,
      }),
    };
  }
  if (type === "restbetrag") {
    const rest = restbetrag != null ? `CHF ${Number(restbetrag).toFixed(2)}` : "";
    const ak = akontoBetrag != null ? `CHF ${Number(akontoBetrag).toFixed(2)}` : "";
    return {
      subject: `Schlussrechnung – 3DMuscio`,
      html: emailLayout({
        title: "Schlussrechnung",
        bodyHtml: `${greet}<p>anbei erhalten Sie unsere Schlussrechnung für den Auftrag „${orderName}".</p>${ak ? `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin:20px 0;"><div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>Gesamtbetrag</span><span>CHF ${(Number(akontoBetrag) + Number(restbetrag)).toFixed(2)}</span></div><div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>Akonto (${akontoPercent}%)</span><span style="color:#22c55e;">- ${ak}</span></div><div style="border-top:1px solid #e5e7eb;padding-top:8px;display:flex;justify-content:space-between;"><strong>Restbetrag (fällig)</strong><strong style="font-size:18px;">${rest}</strong></div></div>` : ""}<p>Mit freundlichen Grüssen<br><strong>3DMuscio</strong></p>`,
      }),
    };
  }
  if (type === "auftragsbestaetigung") {
    return {
      subject: `Auftragsbestätigung – ${orderName} | 3DMuscio`,
      html: emailLayout({
        title: "Auftrag bestätigt",
        bodyHtml: `${greet}<p>wir freuen uns, dass Ihr Auftrag <strong>„${orderName}"</strong> bestätigt wurde und wir mit der Bearbeitung beginnen.</p><p style="color:#6b7280;font-size:13px;">Auftrag Nr. ${orderNr} · ${datum}</p><p>Mit freundlichen Grüssen<br><strong>3DMuscio</strong></p>`,
      }),
    };
  }
  if (type === "druckfertig") {
    return {
      subject: `Ihre 3D-Druckteile sind fertig – „${orderName}"`,
      html: emailLayout({
        title: "Teile fertig gedruckt",
        bodyHtml: `${greet}<p>Ihre 3D-Druckteile für den Auftrag <strong>„${orderName}"</strong> wurden erfolgreich gedruckt und gehen nun in die Nachbearbeitung.</p><p>Sie erhalten eine weitere Benachrichtigung, sobald Ihr Paket unterwegs ist.</p><p>Mit freundlichen Grüssen<br><strong>3DMuscio</strong></p>`,
      }),
    };
  }
  if (type === "test") {
    return {
      subject: `Test-E-Mail von 3DMuscio`,
      html: emailLayout({
        title: "✉️ Test-E-Mail",
        bodyHtml: `${greet}<p>dies ist eine Test-E-Mail von 3DMuscio. Wenn Sie diese Nachricht erhalten, funktioniert der E-Mail-Versand zu Ihrer Adresse einwandfrei.</p><p style="color:#6b7280;font-size:13px;">Bezug: Auftrag „${orderName}" · Nr. ${orderNr}${datum ? ` · ${datum}` : ""}</p><p>Sie müssen auf diese E-Mail nicht antworten.</p><p>Mit freundlichen Grüssen<br><strong>3DMuscio</strong></p>`,
      }),
    };
  }
  if (type === "lieferung") {
    return {
      subject: `Ihre Bestellung „${orderName}" wurde versendet`,
      html: emailLayout({
        title: "Bestellung versendet",
        bodyHtml: `${greet}<p>Ihre Bestellung wurde soeben versendet.</p>${trackingNr ? `<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:16px 20px;margin:20px 0;"><p style="margin:0 0 4px;font-size:12px;color:#16a34a;font-weight:700;text-transform:uppercase;">Tracking-Nummer</p><p style="margin:0;font-size:18px;font-weight:700;letter-spacing:0.1em;">${trackingNr}</p></div>` : ""}<p>Mit freundlichen Grüssen<br><strong>3DMuscio</strong></p>`,
      }),
    };
  }
  return {
    subject: `Information zu Ihrem Auftrag – 3DMuscio`,
    html: emailLayout({ title: "Information", bodyHtml: `${greet}<p>Information zu Ihrem Auftrag „${orderName}".</p>` }),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Auth: Admin erforderlich
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

    const body = await req.json();
    const { kind, orderId, type, statusKey, trackingNr, pdfBase64, pdfFilename, paymentUrl, akontoPercent, akontoBetrag, restbetrag } = body;

    // Auftrag + Kunde laden
    const { data: order } = await supabase
      .from("orders").select("*, customers(*)").eq("id", orderId).maybeSingle();
    if (!order) {
      return new Response(JSON.stringify({ error: "Auftrag nicht gefunden" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const customer = (order as any).customers;
    if (!customer?.email) {
      return new Response(JSON.stringify({ error: "Kein E-Mail beim Kunden hinterlegt" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const customerName = [customer.vorname, customer.name].filter(Boolean).join(" ") || customer.name || "Kunde";
    const orderNr = order.id.slice(0, 8).toUpperCase();
    const orderName = (order as any).name || order.beschreibung || `Auftrag ${orderNr}`;
    const datum = order.datum ? new Date(order.datum).toLocaleDateString("de-CH") : "";

    let subject = "";
    let html = "";

    if (kind === "status") {
      const key = STATUS_KEY_MAP[statusKey] || statusKey;
      const s = STATUS_TEXTS[key];
      if (!s) {
        return new Response(JSON.stringify({ skipped: true, reason: "unknown-status" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      subject = `${s.subject} – ${orderName}`;
      html = emailLayout({
        title: `${s.emoji} ${s.title}`,
        bodyHtml: `<p>Guten Tag ${customerName},</p><p>${s.intro}</p><p style="color:#6b7280;font-size:13px;">Auftrag Nr. ${orderNr}${datum ? ` · ${datum}` : ""}</p><p>Mit freundlichen Grüssen<br><strong>3DMuscio</strong></p>`,
      });
    } else {
      // kind === "order" / default
      const built = buildOrderEmail({
        type, customerName, orderNr, orderName, datum,
        paymentUrl, trackingNr, akontoPercent, akontoBetrag, restbetrag,
      });
      subject = built.subject;
      html = built.html;
    }

    const sendOpts: Record<string, unknown> = {
      from: FROM_EMAIL,
      to: customer.email,
      reply_to: REPLY_TO,
      subject,
      html,
    };
    if (pdfBase64 && pdfFilename) {
      sendOpts.attachments = [{ filename: pdfFilename, content: pdfBase64 }];
    }

    const { data: sent, error: sendError } = await resend.emails.send(sendOpts as any);
    if (sendError) {
      console.error("Resend error:", sendError);
      return new Response(JSON.stringify({ error: String((sendError as any).message || sendError) }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, id: (sent as any)?.id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
