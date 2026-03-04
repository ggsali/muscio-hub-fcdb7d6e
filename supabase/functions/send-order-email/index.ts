import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json();
  const { orderId, type, trackingNr, pdfBase64, pdfFilename, akontoPercent, akontoBetrag, restbetrag } = body;


    // Fetch order
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("*, customers(*)")
      .eq("id", orderId)
      .single();

    if (orderErr || !order) {
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

    // Fetch company settings
    const { data: settings } = await supabase.from("company_settings").select("*");
    const getSetting = (key: string) => settings?.find((s: any) => s.key === key)?.value ?? "";
    const companyName = getSetting("firmenname") || "3dMuscio";
    const companyEmail = getSetting("email") || "";

    const orderNr = order.id.slice(0, 8).toUpperCase();
    const orderName = (order as any).name || order.beschreibung || `Auftrag ${orderNr}`;
    const datum = order.datum ? new Date(order.datum).toLocaleDateString("de-CH") : "";

    const customerName = [customer.vorname, customer.name].filter(Boolean).join(" ") || customer.name;

    let subject = "";
    let htmlBody = "";

    if (type === "rechnung") {
      subject = `Rechnung ${orderNr} – ${companyName}`;
      htmlBody = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
          <div style="background:#18181b;padding:24px 32px;border-radius:8px 8px 0 0;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;">${companyName}</h1>
          </div>
          <div style="background:#ffffff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
            <p>Guten Tag ${customerName},</p>
            <p>vielen Dank für Ihren Auftrag. Im Anhang finden Sie Ihre Rechnung <strong>Nr. ${orderNr}</strong> vom ${datum}.</p>
            <p style="color:#6b7280;font-size:13px;">Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>
            <p>Mit freundlichen Grüssen<br><strong>${companyName}</strong></p>
          </div>
        </div>`;
    } else if (type === "offerte") {
      const datumClean = order.datum ? order.datum.replace(/-/g, "") : new Date().toISOString().split("T")[0].replace(/-/g, "");
      const offerNr = `OF-${datumClean}-${orderId.slice(0, 6).toUpperCase()}`;
      subject = `Offerte ${offerNr} – ${companyName}`;
      htmlBody = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
          <div style="background:#18181b;padding:24px 32px;border-radius:8px 8px 0 0;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;">${companyName}</h1>
          </div>
          <div style="background:#ffffff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
            <p>Guten Tag ${customerName},</p>
            <p>gerne unterbreiten wir Ihnen unser Angebot. Im Anhang finden Sie die Offerte <strong>${offerNr}</strong> vom ${datum}.</p>
            <p style="color:#6b7280;font-size:13px;">Für Rückfragen stehen wir Ihnen gerne zur Verfügung.</p>
            <p>Mit freundlichen Grüssen<br><strong>${companyName}</strong></p>
          </div>
        </div>`;
    } else if (type === "akonto") {
      const datumClean = order.datum ? order.datum.replace(/-/g, "") : new Date().toISOString().split("T")[0].replace(/-/g, "");
      const akontoNr = `AK-${datumClean}-${orderId.slice(0, 6).toUpperCase()}`;
      const akontoFormatted = akontoBetrag != null ? `CHF ${Number(akontoBetrag).toFixed(2)}` : "";
      subject = `Akontorechnung ${akontoNr} – ${companyName}`;
      htmlBody = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
          <div style="background:#18181b;padding:24px 32px;border-radius:8px 8px 0 0;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;">${companyName}</h1>
          </div>
          <div style="background:#ffffff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
            <p>Guten Tag ${customerName},</p>
            <p>anbei erhalten Sie unsere Akontorechnung <strong>${akontoNr}</strong> für den Auftrag "${orderName}".</p>
            ${akontoFormatted ? `
            <div style="background:#fff7ed;border:1px solid #fdba74;border-radius:8px;padding:16px 20px;margin:20px 0;">
              <p style="margin:0 0 4px;font-size:12px;color:#ea580c;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Akontozahlung (${akontoPercent}%)</p>
              <p style="margin:0;font-size:22px;font-weight:700;">${akontoFormatted}</p>
            </div>` : ""}
            <p>Die vollständige Akontorechnung finden Sie im Anhang als PDF.</p>
            <p style="color:#6b7280;font-size:13px;">Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>
            <p>Mit freundlichen Grüssen<br><strong>${companyName}</strong></p>
          </div>
        </div>`;
    } else if (type === "restbetrag") {
      const datumClean = order.datum ? order.datum.replace(/-/g, "") : new Date().toISOString().split("T")[0].replace(/-/g, "");
      const restNr = `RS-${datumClean}-${orderId.slice(0, 6).toUpperCase()}`;
      const restFormatted = restbetrag != null ? `CHF ${Number(restbetrag).toFixed(2)}` : "";
      const akontoFormatted = akontoBetrag != null ? `CHF ${Number(akontoBetrag).toFixed(2)}` : "";
      subject = `Schlussrechnung ${restNr} – ${companyName}`;
      htmlBody = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
          <div style="background:#18181b;padding:24px 32px;border-radius:8px 8px 0 0;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;">${companyName}</h1>
          </div>
          <div style="background:#ffffff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
            <p>Guten Tag ${customerName},</p>
            <p>anbei erhalten Sie unsere Schlussrechnung <strong>${restNr}</strong> für den Auftrag "${orderName}".</p>
            ${akontoFormatted ? `
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin:20px 0;">
              <p style="margin:0 0 8px;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Zahlungsübersicht</p>
              <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                <span style="color:#6b7280;font-size:13px;">Gesamtbetrag</span>
                <span style="font-size:13px;">CHF ${(Number(akontoBetrag) + Number(restbetrag)).toFixed(2)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                <span style="color:#6b7280;font-size:13px;">Abzüglich Akonto (${akontoPercent}%)</span>
                <span style="font-size:13px;color:#ea580c;">- ${akontoFormatted}</span>
              </div>
              <div style="border-top:1px solid #e5e7eb;padding-top:8px;margin-top:4px;display:flex;justify-content:space-between;">
                <span style="font-size:14px;font-weight:700;">Restbetrag (fällig)</span>
                <span style="font-size:18px;font-weight:700;">${restFormatted}</span>
              </div>
            </div>` : ""}
            <p>Die vollständige Schlussrechnung finden Sie im Anhang als PDF.</p>
            <p style="color:#6b7280;font-size:13px;">Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>
            <p>Mit freundlichen Grüssen<br><strong>${companyName}</strong></p>
          </div>
        </div>`;
    } else if (type === "auftragsbestaetigung") {
      subject = `Auftragsbestätigung – ${orderName} | ${companyName}`;
      htmlBody = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
          <div style="background:#18181b;padding:24px 32px;border-radius:8px 8px 0 0;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;">${companyName}</h1>
          </div>
          <div style="background:#ffffff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
            <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:16px 20px;margin-bottom:24px;display:flex;align-items:center;gap:12px;">
              <span style="font-size:28px;">✅</span>
              <div>
                <p style="margin:0;font-size:15px;font-weight:700;color:#16a34a;">Ihr Auftrag wurde bestätigt!</p>
                <p style="margin:4px 0 0;font-size:12px;color:#6b7280;">Auftrag Nr. ${orderNr} · ${datum}</p>
              </div>
            </div>
            <p>Guten Tag ${customerName},</p>
            <p>wir freuen uns, Ihnen mitteilen zu können, dass Ihr Auftrag <strong>„${orderName}"</strong> angenommen wurde und wir mit der Bearbeitung beginnen.</p>
            <p>Bei Fragen oder Änderungswünschen stehen wir Ihnen jederzeit zur Verfügung.</p>
            <p style="color:#6b7280;font-size:13px;">Vielen Dank für Ihr Vertrauen.</p>
            <p>Mit freundlichen Grüssen<br><strong>${companyName}</strong></p>
          </div>
        </div>`;
    } else if (type === "lieferung") {
      const trackingNrVal = trackingNr || order.tracking_nr || "";
      subject = `Ihre Bestellung "${orderName}" wurde geliefert`;
      htmlBody = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
          <div style="background:#18181b;padding:24px 32px;border-radius:8px 8px 0 0;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;">${companyName}</h1>
          </div>
          <div style="background:#ffffff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
              <div style="width:48px;height:48px;background:#dcfce7;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;">📦</div>
              <div>
                <h2 style="margin:0;font-size:18px;">Bestellung geliefert!</h2>
                <p style="margin:4px 0 0;color:#6b7280;font-size:13px;">Auftrag ${orderNr} · ${datum}</p>
              </div>
            </div>
            <p>Guten Tag ${customerName},</p>
            <p>Ihre Bestellung wurde soeben versendet.</p>
            ${trackingNrVal ? `
            <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:16px 20px;margin:20px 0;">
              <p style="margin:0 0 4px;font-size:12px;color:#16a34a;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Tracking-Nummer</p>
              <p style="margin:0;font-size:18px;font-weight:700;letter-spacing:0.1em;">${trackingNrVal}</p>
              <p style="margin:6px 0 0;font-size:12px;color:#6b7280;">Verfolgen Sie Ihre Sendung auf der Website des Paketdienstes.</p>
            </div>` : ""}
            <p style="color:#6b7280;font-size:13px;">Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>
            <p>Mit freundlichen Grüssen<br><strong>${companyName}</strong></p>
          </div>
        </div>`;
    }

    const senderName = companyName;
    const fromEmail = companyEmail ? `${senderName} <${companyEmail}>` : `${senderName} <onboarding@resend.dev>`;

    // Build email payload – attach PDF if provided
    const emailPayload: Record<string, unknown> = {
      from: fromEmail,
      to: [customer.email],
      subject,
      html: htmlBody,
    };

    if (pdfBase64 && pdfFilename) {
      emailPayload.attachments = [
        {
          filename: pdfFilename,
          content: pdfBase64,
        },
      ];
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    const resData = await res.json();

    if (!res.ok) {
      console.error("Resend error:", resData);
      return new Response(JSON.stringify({ error: resData.message || "E-Mail Fehler" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, id: resData.id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
