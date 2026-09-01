import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, verifyWebhook } from "../_shared/stripe.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
  }
  return _supabase;
}

async function handleCheckoutSessionCompleted(session: any, env: StripeEnv) {
  const shopOrderId = session.metadata?.shop_order_id;
  if (!shopOrderId) {
    console.warn("[payments-webhook] No shop_order_id in session metadata; ignoring");
    return;
  }

  const cd = session.customer_details;
  const addr = cd?.address;
  const fullName = cd?.name || "Webshop-Kunde";
  const email = cd?.email || "noemail@webshop.local";
  const phone = cd?.phone || null;

  const { data: existingOrder } = await getSupabase()
    .from("shop_orders")
    .select("id, status")
    .eq("id", shopOrderId)
    .maybeSingle();

  if (!existingOrder) {
    console.warn("[payments-webhook] shop_order not found:", shopOrderId);
    return;
  }
  if (existingOrder.status === "paid") {
    console.log("[payments-webhook] shop_order already paid:", shopOrderId);
    return;
  }

  const totalChf = (session.amount_total ?? 0) / 100;

  const { error: updErr } = await getSupabase().from("shop_orders").update({
    status: "paid",
    paid_at: new Date().toISOString(),
    customer_email: email,
    customer_name: fullName,
    customer_phone: phone,
    shipping_address: addr?.line1 || "—",
    shipping_city: addr?.city || "—",
    shipping_postal_code: addr?.postal_code || "—",
    shipping_country: addr?.country || "Schweiz",
    total: totalChf,
  }).eq("id", shopOrderId);
  if (updErr) {
    console.error("[payments-webhook] shop_orders update failed:", updErr);
    throw updErr;
  }

  let customerId: string | null = null;
  const { data: existCust } = await getSupabase().from("customers").select("id").eq("email", email).maybeSingle();
  if (existCust) {
    customerId = existCust.id;
  } else {
    const parts = fullName.split(" ");
    const vorname = parts[0] || "";
    const name = parts.slice(1).join(" ") || fullName;
    const { data: newCust, error: custErr } = await getSupabase().from("customers").insert({
      name, vorname, email, telefon: phone,
      strasse: addr?.line1 || null, plz: addr?.postal_code || null,
      ort: addr?.city || null, land: addr?.country || "Schweiz",
      notizen: "Automatisch aus Webshop-Bestellung importiert",
    }).select("id").single();
    if (custErr) console.error("[payments-webhook] customer insert failed:", custErr);
    customerId = newCust?.id ?? null;
  }

  const { data: items } = await getSupabase()
    .from("shop_order_items")
    .select("product_id, product_name, quantity, unit_price, total, optionen")
    .eq("order_id", shopOrderId);

  const desc = (items || []).map((i: any) => `${i.quantity}× ${i.product_name} (CHF ${Number(i.total).toFixed(2)})`).join("\n");

  const { data: newOrder, error: orderErr } = await getSupabase().from("orders").insert({
    customer_id: customerId,
    name: `Webshop-Bestellung #${shopOrderId.substring(0, 8)}`,
    beschreibung: desc,
    status: "Offen",
    source: "website-shop",
    umsatz_total: totalChf,
    kosten_total: 0,
    gewinn_total: totalChf,
    marge: 100,
  }).select("id").single();
  if (orderErr) console.error("[payments-webhook] orders insert failed:", orderErr);

  if (newOrder) {
    await getSupabase().from("shop_orders").update({ order_id: newOrder.id }).eq("id", shopOrderId);
    await getSupabase().from("order_status_log").insert({
      order_id: newOrder.id,
      status: "Offen",
      notiz: `Aus Webshop importiert. Stripe Session: ${session.id}`,
    });
  }

  // Lagerbestände reduzieren (Produkt + Optionswerte)
  for (const it of (items || []) as any[]) {
    if (it.product_id) {
      const { data: prodRow } = await getSupabase()
        .from("shop_products")
        .select("id, lagerbestand, unendlich_bestand")
        .eq("id", it.product_id)
        .maybeSingle();
      if (prodRow && !prodRow.unendlich_bestand) {
        await getSupabase().from("shop_products").update({
          lagerbestand: Math.max(0, (prodRow.lagerbestand || 0) - it.quantity),
        }).eq("id", prodRow.id);
      }
    }
    for (const opt of (it.optionen || []) as any[]) {
      if (!opt?.wertId) continue;
      const { data: wert } = await getSupabase()
        .from("shop_produkt_option_werte")
        .select("id, lagerbestand")
        .eq("id", opt.wertId)
        .maybeSingle();
      if (wert && wert.lagerbestand !== null && wert.lagerbestand !== undefined) {
        await getSupabase().from("shop_produkt_option_werte").update({
          lagerbestand: Math.max(0, Number(wert.lagerbestand) - it.quantity),
        }).eq("id", wert.id);
      }
    }
  }

  // Zahlungsbestätigung per E-Mail
  try {
    const { error: mailErr } = await getSupabase().functions.invoke("send-transactional-email", {
      body: {
        templateName: "zahlung-bestaetigung",
        recipientEmail: email,
        idempotencyKey: `shop-payment-${session.id}`,
        templateData: {
          customerName: fullName,
          orderName: `Webshop-Bestellung #${shopOrderId.substring(0, 8)}`,
          orderNr: shopOrderId.substring(0, 8).toUpperCase(),
          amountFormatted: `CHF ${totalChf.toFixed(2)}`,
        },
      },
    });
    if (mailErr) console.error("[payments-webhook] confirmation email failed:", mailErr);
  } catch (e) {
    console.error("[payments-webhook] confirmation email exception:", e);
  }

  console.log(`[payments-webhook] shop_order ${shopOrderId} paid (${env}), CHF ${totalChf.toFixed(2)}`);
}


async function handleTransactionCompleted(transaction: any, env: StripeEnv) {
  // For one-time payments, the transaction may carry a session_id in metadata.
  // If not, try to find the session via the payment intent.
  const sessionId = transaction?.metadata?.checkout_session_id;
  if (!sessionId) {
    console.log("[payments-webhook] transaction.completed without checkout_session_id; ignoring");
    return;
  }

  // We need to fetch the session to get shop_order_id metadata.
  // This requires the Stripe client, which we don't have here without env.
  // The transaction object is usually for Stripe Billing; for shop one-time
  // payments we rely on checkout.session.completed.
  console.log("[payments-webhook] transaction.completed for session", sessionId, "env", env);
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);

  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutSessionCompleted(event.data.object, env);
      break;
    case "transaction.completed":
      await handleTransactionCompleted(event.data.object, env);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.canceled":
    case "transaction.payment_failed":
      console.log("[payments-webhook] received event:", event.type);
      break;
    default:
      console.log("[payments-webhook] unhandled event:", event.type);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const rawEnv = new URL(req.url).searchParams.get("env");
  if (rawEnv !== "sandbox" && rawEnv !== "live") {
    console.error("[payments-webhook] Invalid or missing env:", rawEnv);
    return new Response(JSON.stringify({ received: true, ignored: "invalid env" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const env: StripeEnv = rawEnv;

  try {
    await handleWebhook(req, env);
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[payments-webhook] error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Webhook error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
