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
    const { orderId, type, trackingNr, pdfBase64, pdfFilename } = body;

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
      const offerNr = `OF-${order.datum?.replace(/-/g, "") ?? ""}-${orderId.slice(0, 6).toUpperCase()}`;
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
