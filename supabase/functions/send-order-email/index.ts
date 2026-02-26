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
    const { orderId, type, trackingNr } = body;
    // type: "rechnung" | "offerte" | "lieferung"

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
    const companyName = getSetting("name") || "Muscio";
    const companyEmail = getSetting("email") || "";

    // Fetch parts
    const { data: parts } = await supabase.from("parts").select("*").eq("order_id", orderId);

    const orderNr = order.id.slice(0, 8).toUpperCase();
    const orderName = (order as any).name || order.beschreibung || `Auftrag ${orderNr}`;
    const datum = order.datum ? new Date(order.datum).toLocaleDateString("de-CH") : "";
    const total = (order.umsatz_total ?? 0).toFixed(2);

    // Build parts table rows
    const partsRows = (parts ?? []).map((p: any) =>
      `<tr style="border-bottom:1px solid #eee;">
        <td style="padding:8px 12px;">${p.teilname}</td>
        <td style="padding:8px 12px;text-align:center;">${p.menge}x</td>
        <td style="padding:8px 12px;text-align:right;">CHF ${p.preis_pro_stueck?.toFixed(2)}</td>
        <td style="padding:8px 12px;text-align:right;">CHF ${p.preis_total?.toFixed(2)}</td>
      </tr>`
    ).join("");

    let subject = "";
    let htmlBody = "";

    if (type === "rechnung") {
      subject = `Rechnung: ${orderName} – ${companyName}`;
      htmlBody = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
          <div style="background:#18181b;padding:24px 32px;border-radius:8px 8px 0 0;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;">${companyName}</h1>
          </div>
          <div style="background:#ffffff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
            <h2 style="font-size:18px;margin:0 0 8px;">Rechnung Nr. ${orderNr}</h2>
            <p style="color:#6b7280;margin:0 0 24px;">Datum: ${datum}</p>
            
            <p>Guten Tag ${customer.name},</p>
            <p>vielen Dank für Ihren Auftrag. Anbei finden Sie Ihre Rechnung.</p>

            <table style="width:100%;border-collapse:collapse;margin:24px 0;font-size:14px;">
              <thead>
                <tr style="background:#f9fafb;border-bottom:2px solid #e5e7eb;">
                  <th style="padding:10px 12px;text-align:left;">Teil</th>
                  <th style="padding:10px 12px;text-align:center;">Menge</th>
                  <th style="padding:10px 12px;text-align:right;">Preis/St.</th>
                  <th style="padding:10px 12px;text-align:right;">Total</th>
                </tr>
              </thead>
              <tbody>${partsRows}</tbody>
              <tfoot>
                <tr style="border-top:2px solid #18181b;">
                  <td colspan="3" style="padding:12px;font-weight:bold;font-size:15px;">Total</td>
                  <td style="padding:12px;font-weight:bold;font-size:15px;text-align:right;">CHF ${total}</td>
                </tr>
              </tfoot>
            </table>

            <p style="color:#6b7280;font-size:13px;">Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>
            <p>Mit freundlichen Grüssen<br><strong>${companyName}</strong></p>
          </div>
        </div>`;
    } else if (type === "offerte") {
      subject = `Offerte: ${orderName} – ${companyName}`;
      const validBis = new Date(order.datum);
      validBis.setDate(validBis.getDate() + 30);
      subject = `Offerte ${orderNr} – ${companyName}`;
      htmlBody = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
          <div style="background:#18181b;padding:24px 32px;border-radius:8px 8px 0 0;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;">${companyName}</h1>
          </div>
          <div style="background:#ffffff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
            <h2 style="font-size:18px;margin:0 0 8px;">Offerte Nr. OF-${orderNr}</h2>
            <p style="color:#6b7280;margin:0 0 4px;">Datum: ${datum}</p>
            <p style="color:#ea580c;margin:0 0 24px;font-size:13px;">Gültig bis: ${validBis.toLocaleDateString("de-CH")}</p>
            
            <p>Guten Tag ${customer.name},</p>
            <p>gerne unterbreiten wir Ihnen folgendes Angebot:</p>

            <table style="width:100%;border-collapse:collapse;margin:24px 0;font-size:14px;">
              <thead>
                <tr style="background:#f9fafb;border-bottom:2px solid #e5e7eb;">
                  <th style="padding:10px 12px;text-align:left;">Teil</th>
                  <th style="padding:10px 12px;text-align:center;">Menge</th>
                  <th style="padding:10px 12px;text-align:right;">Preis/St.</th>
                  <th style="padding:10px 12px;text-align:right;">Total</th>
                </tr>
              </thead>
              <tbody>${partsRows}</tbody>
              <tfoot>
                <tr style="border-top:2px solid #ea580c;">
                  <td colspan="3" style="padding:12px;font-weight:bold;font-size:15px;">Gesamtbetrag</td>
                  <td style="padding:12px;font-weight:bold;font-size:15px;text-align:right;color:#ea580c;">CHF ${total}</td>
                </tr>
              </tfoot>
            </table>

            <p style="color:#6b7280;font-size:13px;">Für Rückfragen stehen wir gerne zur Verfügung.</p>
            <p>Mit freundlichen Grüssen<br><strong>${companyName}</strong></p>
          </div>
        </div>`;
    } else if (type === "lieferung") {
      const trackingNrVal = trackingNr || order.tracking_nr || "";
      subject = `Ihre Bestellung wurde geliefert – ${orderNr}`;
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
            
            <p>Guten Tag ${customer.name},</p>
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

    const fromEmail = companyEmail ? `${companyName} <${companyEmail}>` : `${companyName} <onboarding@resend.dev>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [customer.email],
        subject,
        html: htmlBody,
      }),
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
