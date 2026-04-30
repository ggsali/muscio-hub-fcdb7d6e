import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
  const sb = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const sig = req.headers.get("stripe-signature");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const raw = await req.text();
    if (!webhookSecret) {
      console.error("[shop-webhook] STRIPE_WEBHOOK_SECRET not configured");
      return new Response("Webhook secret not configured", { status: 500, headers: corsHeaders });
    }
    if (!sig) {
      return new Response("Missing stripe-signature header", { status: 400, headers: corsHeaders });
    }
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(raw, sig, webhookSecret);
    } catch (err) {
      console.error("[shop-webhook] Signature verification failed:", err);
      return new Response("Invalid signature", { status: 400, headers: corsHeaders });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const shopOrderId = session.metadata?.shop_order_id;
      if (!shopOrderId) {
        console.warn("No shop_order_id in metadata; ignoring");
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const cd = session.customer_details;
      const addr = cd?.address;
      const fullName = cd?.name || "Webshop-Kunde";
      const email = cd?.email || "noemail@webshop.local";
      const phone = cd?.phone || null;

      // Update shop_order with real customer details + paid status
      await sb.from("shop_orders").update({
        status: "paid",
        paid_at: new Date().toISOString(),
        customer_email: email,
        customer_name: fullName,
        customer_phone: phone,
        shipping_address: addr?.line1 || "—",
        shipping_city: addr?.city || "—",
        shipping_postal_code: addr?.postal_code || "—",
        shipping_country: addr?.country || "Schweiz",
        total: (session.amount_total ?? 0) / 100,
      }).eq("id", shopOrderId);

      // Find or create customer in projekt-manager (customers table)
      let customerId: string | null = null;
      const { data: existCust } = await sb.from("customers").select("id").eq("email", email).maybeSingle();
      if (existCust) {
        customerId = existCust.id;
      } else {
        const parts = fullName.split(" ");
        const vorname = parts[0] || "";
        const name = parts.slice(1).join(" ") || fullName;
        const { data: newCust } = await sb.from("customers").insert({
          name, vorname, email, telefon: phone,
          strasse: addr?.line1 || null, plz: addr?.postal_code || null,
          ort: addr?.city || null, land: addr?.country || "Schweiz",
          notizen: "Automatisch aus Webshop-Bestellung importiert",
        }).select("id").single();
        customerId = newCust?.id ?? null;
      }

      // Get items for description
      const { data: items } = await sb.from("shop_order_items").select("product_name, quantity, unit_price, total").eq("order_id", shopOrderId);
      const desc = (items || []).map(i => `${i.quantity}× ${i.product_name} (CHF ${Number(i.total).toFixed(2)})`).join("\n");

      // Create matching order in projekt-manager
      const { data: newOrder } = await sb.from("orders").insert({
        customer_id: customerId,
        name: `Webshop-Bestellung #${shopOrderId.substring(0, 8)}`,
        beschreibung: desc,
        status: "Offen",
        source: "website-shop",
        umsatz_total: (session.amount_total ?? 0) / 100,
        kosten_total: 0,
        gewinn_total: (session.amount_total ?? 0) / 100,
        marge: 100,
      }).select("id").single();

      if (newOrder) {
        await sb.from("shop_orders").update({ order_id: newOrder.id }).eq("id", shopOrderId);
        await sb.from("order_status_log").insert({
          order_id: newOrder.id,
          status: "Offen",
          notiz: `Aus Webshop importiert. Stripe Session: ${session.id}`,
        });
      }

      // Decrement stock
      if (items) {
        for (const it of items as any[]) {
          const { data: prodRow } = await sb.from("shop_products").select("lagerbestand, unendlich_bestand").eq("name", it.product_name).maybeSingle();
          if (prodRow && !prodRow.unendlich_bestand) {
            await sb.from("shop_products").update({
              lagerbestand: Math.max(0, (prodRow.lagerbestand || 0) - it.quantity),
            }).eq("name", it.product_name);
          }
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("shop-webhook error:", e);
    return new Response(JSON.stringify({ error: e?.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
