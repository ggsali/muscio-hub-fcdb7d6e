import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { order_id } = await req.json();
    if (!order_id) throw new Error("order_id required");

    // Load Swiss Post credentials from app_settings table
    const { data: settingsRows } = await supabase
      .from("settings")
      .select("key,value")
      .in("key", [
        "swiss_post_customer_no",
        "swiss_post_franking_license",
        "swiss_post_api_user",
        "swiss_post_api_password",
        "swiss_post_produkt",
      ]);

    const settingsMap: Record<string, string> = {};
    (settingsRows || []).forEach((r: any) => { settingsMap[r.key] = r.value; });

    const postCustomerNo = settingsMap["swiss_post_customer_no"] || Deno.env.get("SWISS_POST_CUSTOMER_NO");
    const postFrankingLicense = settingsMap["swiss_post_franking_license"] || Deno.env.get("SWISS_POST_FRANKING_LICENSE");
    const postApiUser = settingsMap["swiss_post_api_user"] || Deno.env.get("SWISS_POST_API_USER");
    const postApiPassword = settingsMap["swiss_post_api_password"] || Deno.env.get("SWISS_POST_API_PASSWORD");
    const produkt = settingsMap["swiss_post_produkt"] || "PRI";

    if (!postCustomerNo || !postFrankingLicense || !postApiUser || !postApiPassword) {
      throw new Error("Swiss Post API credentials not configured. Please add them in settings.");
    }

    // Fetch order + customer
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, order_number, customer_id, beschreibung")
      .eq("id", order_id)
      .single();
    if (orderErr || !order) throw new Error("Order not found");

    const { data: customer, error: custErr } = await supabase
      .from("customers")
      .select("name, vorname, firma, strasse, hausnummer, plz, ort, land")
      .eq("id", order.customer_id)
      .single();
    if (custErr || !customer) throw new Error("Customer not found");

    // Fetch company settings for sender address
    const { data: companyRows } = await supabase.from("company_settings").select("*");
    const company: any = companyRows?.[0] || {};

    // Parse sender address — stored as "Strasse Nr, PLZ Ort" or multi-line
    const rawAdresse = (company.adresse || "").replace(/\n/g, ", ");
    const adresseParts = rawAdresse.split(",").map((s: string) => s.trim());
    const senderStrasse = adresseParts[0] || "Musterstrasse 1";
    const plzOrtParts = (adresseParts[1] || "8200 Schaffhausen").trim().split(" ");
    const senderPlz = plzOrtParts[0] || "8200";
    const senderOrt = plzOrtParts.slice(1).join(" ") || "Schaffhausen";

    // Recipient
    const recipientName = customer.firma
      ? customer.firma
      : `${customer.vorname || ""} ${customer.name || ""}`.trim();
    const recipientZusatz = customer.firma
      ? `${customer.vorname || ""} ${customer.name || ""}`.trim()
      : "";
    const recipientStrasse = [customer.strasse, customer.hausnummer].filter(Boolean).join(" ").trim();
    const recipientPlz = customer.plz || "";
    const recipientOrt = customer.ort || "";
    const recipientLand = (customer.land || "CH").toUpperCase().slice(0, 2);

    const orderLabel = order.order_number
      ? String(order.order_number).padStart(8, "0")
      : order_id.slice(0, 8).toUpperCase();

    // Swiss Post Barcode Web Service v2
    const requestBody = {
      Language: "de",
      FrankingLicense: postFrankingLicense,
      PpFranking: false,
      ImageFileType: "PDF",
      ImageResolution: 300,
      Sendungen: [
        {
          DataIdentifier: "109",
          Produkt: produkt,
          Services: [],
          Sender: {
            Name1: company.firmenname || "3dMuscio",
            Street: senderStrasse,
            ZIP: senderPlz,
            City: senderOrt,
            Country: "CH",
          },
          Recipient: {
            Name1: recipientName,
            ...(recipientZusatz ? { Name2: recipientZusatz } : {}),
            Street: recipientStrasse,
            ZIP: recipientPlz,
            City: recipientOrt,
            Country: recipientLand,
          },
          AdditionalINFOS: [
            {
              Type: "SENDUNGSNUMMER",
              Value: orderLabel,
            },
          ],
        },
      ],
    };

    const credentials = btoa(`${postApiUser}:${postApiPassword}`);

    const postResponse = await fetch(
      "https://wedec.post.ch/WEDECBarcode/barcode/v2/generateAddressLabel",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${credentials}`,
          "Customer-Number": postCustomerNo,
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!postResponse.ok) {
      const errText = await postResponse.text();
      console.error("Swiss Post API error:", postResponse.status, errText);
      throw new Error(`Swiss Post API ${postResponse.status}: ${errText.slice(0, 300)}`);
    }

    const result = await postResponse.json();
    const labelBase64 = result?.Sendungen?.[0]?.Label;
    if (!labelBase64) {
      console.error("Swiss Post response:", JSON.stringify(result));
      throw new Error("Kein Label in der Antwort der Post API");
    }

    // Log to activity log
    await supabase.from("order_status_log").insert({
      order_id,
      status: "📦 Versandetikette erstellt",
      notiz: null,
    });

    return new Response(
      JSON.stringify({
        success: true,
        label_base64: labelBase64,
        filename: `versandetikette_${orderLabel}.pdf`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("generate-shipping-label error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
