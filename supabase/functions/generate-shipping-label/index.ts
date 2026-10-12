import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeStreet } from "../_shared/address.ts";
import {
  POST_TOKEN_URL, POST_LABEL_URL, POST_SCOPE,
  countryToIso, validateAddress, buildGenerateLabelRequest, extractLabelResult,
} from "../_shared/swiss-post.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** OAuth2 Client-Credentials gegen die Post holen (Token gilt nur ~5 Minuten, daher pro Aufruf neu). */
async function getPostToken(clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch(POST_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: POST_SCOPE,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    console.error("Swiss Post OAuth error:", res.status, t.slice(0, 300));
    throw new Error(`Swiss Post Anmeldung fehlgeschlagen (${res.status}). Client-ID/Secret prüfen. ${t.slice(0, 200)}`);
  }
  const json = await res.json();
  if (!json?.access_token) throw new Error("Swiss Post Anmeldung: kein Access-Token erhalten");
  return json.access_token as string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { order_id } = await req.json();
    if (!order_id) throw new Error("order_id required");

    // Zugangsdaten: Secret bevorzugt aus den Edge-Function-Secrets, sonst aus der settings-Tabelle
    const { data: settingsRows } = await supabase
      .from("settings")
      .select("key,value")
      .in("key", [
        "swiss_post_client_id",
        "swiss_post_client_secret",
        "swiss_post_franking_license",
        "swiss_post_produkt",
        "swiss_post_label_layout",
        "swiss_post_test_mode",
      ]);

    const s: Record<string, string> = {};
    (settingsRows || []).forEach((r: any) => { s[r.key] = r.value; });

    const clientId = Deno.env.get("SWISS_POST_CLIENT_ID") || s["swiss_post_client_id"];
    const clientSecret = Deno.env.get("SWISS_POST_CLIENT_SECRET") || s["swiss_post_client_secret"];
    const frankingLicense = Deno.env.get("SWISS_POST_FRANKING_LICENSE") || s["swiss_post_franking_license"];
    const produkt = s["swiss_post_produkt"] || "PRI";
    const labelLayout = s["swiss_post_label_layout"] || "A6";
    // Solange nichts anderes eingestellt ist: Testmodus (SPECIMEN-Etikette, kostenlos, nicht versandgültig)
    const testMode = (s["swiss_post_test_mode"] ?? "1") !== "0";

    if (!clientId || !clientSecret || !frankingLicense) {
      throw new Error("Swiss Post API credentials not configured. Bitte Client-ID, Client-Secret und Frankierlizenz in den Einstellungen eintragen.");
    }

    // Auftrag + Kunde
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, order_number, customer_id, beschreibung, tracking_nr")
      .eq("id", order_id)
      .single();
    if (orderErr || !order) throw new Error("Order not found");

    const { data: customer, error: custErr } = await supabase
      .from("customers")
      .select("name, vorname, firma, strasse, hausnummer, plz, ort, land")
      .eq("id", order.customer_id)
      .single();
    if (custErr || !customer) throw new Error("Customer not found");

    // Absender aus den Firmeneinstellungen ("Strasse Nr, PLZ Ort")
    const { data: companyRows } = await supabase.from("company_settings").select("key,value");
    const company: Record<string, string> = {};
    (companyRows || []).forEach((r: any) => { company[r.key] = r.value; });

    const parts = String(company.adresse || "").replace(/\n/g, ",").split(",").map((p) => p.trim()).filter(Boolean);
    const plzIdx = parts.findIndex((p) => /^\d{4,5}\s+\S/.test(p));
    if (plzIdx < 1) {
      throw new Error('Absenderadresse unvollständig. Bitte unter Einstellungen → Firma die Adresse als "Strasse Nr, PLZ Ort" eintragen.');
    }
    const sender = {
      name1: company.firmenname || "3dMuscio",
      street: parts.slice(0, plzIdx).join(", "),
      zip: parts[plzIdx].split(/\s+/)[0],
      city: parts[plzIdx].split(/\s+/).slice(1).join(" "),
      country: "CH",
    };

    // Empfänger: Hausnummer sauber vom Strassennamen trennen
    const addr = normalizeStreet(customer.strasse, customer.hausnummer);
    const country = countryToIso(customer.land);
    if (!country) throw new Error(`Land "${customer.land}" wird nicht erkannt. Bitte beim Kunden einen gültigen Ländernamen oder Ländercode eintragen.`);

    const personName = `${customer.vorname || ""} ${customer.name || ""}`.trim();
    const recipient = {
      name1: customer.firma ? customer.firma : personName,
      name2: customer.firma ? personName : undefined,
      street: addr.strasse,
      houseNo: addr.hausnummer || undefined,
      zip: String(customer.plz || "").trim(),
      city: String(customer.ort || "").trim(),
      country,
    };

    const problem = validateAddress(sender, "Absender") || validateAddress(recipient, "Empfänger");
    if (problem) throw new Error(problem);

    const orderLabel = order.order_number
      ? String(order.order_number).padStart(8, "0")
      : String(order_id).slice(0, 8).toUpperCase();

    const body = buildGenerateLabelRequest({
      frankingLicense, produkt, testMode, labelLayout, itemId: orderLabel, sender, recipient,
    });

    const token = await getPostToken(clientId, clientSecret);
    const postResponse = await fetch(POST_LABEL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });

    if (!postResponse.ok) {
      const errText = await postResponse.text();
      console.error("Swiss Post API error:", postResponse.status, errText.slice(0, 500));
      throw new Error(`Swiss Post API ${postResponse.status}: ${errText.slice(0, 300)}`);
    }

    const result = extractLabelResult(await postResponse.json());
    if (result.errors) {
      console.error("Swiss Post item errors:", JSON.stringify(result.errors).slice(0, 500));
      throw new Error(`Swiss Post meldet Fehler: ${JSON.stringify(result.errors).slice(0, 300)}`);
    }
    if (!result.label) throw new Error("Kein Label in der Antwort der Post API");

    // Sendungsnummer im Auftrag speichern – nicht im Testmodus (SPECIMEN-Nummern sind ungültig)
    // und nie eine von Hand erfasste Nummer überschreiben.
    let trackingSaved = false;
    if (!testMode && result.identCode && !order.tracking_nr) {
      const { error: trErr } = await supabase.from("orders").update({ tracking_nr: result.identCode }).eq("id", order_id);
      if (trErr) console.error("tracking_nr speichern fehlgeschlagen:", trErr.message);
      else trackingSaved = true;
    }

    await supabase.from("order_status_log").insert({
      order_id,
      status: testMode ? "📦 Test-Versandetikette erstellt" : "📦 Versandetikette erstellt",
      notiz: testMode ? "Testmodus (SPECIMEN), nicht für den Versand gültig" : (result.identCode ? `Sendungsnummer ${result.identCode}` : null),
    });

    return new Response(
      JSON.stringify({
        success: true,
        label_base64: result.label,
        filename: `${testMode ? "TEST_" : ""}versandetikette_${orderLabel}.pdf`,
        tracking_nr: result.identCode,
        tracking_saved: trackingSaved,
        test_mode: testMode,
        warnings: result.warnings,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("generate-shipping-label error:", err?.message || err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || String(err) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
