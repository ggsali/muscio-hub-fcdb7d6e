import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CheckoutItem { productId: string; name: string; quantity: number; preis: number; }

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { items, customer, totals, successUrl, cancelUrl } = await req.json() as {
      items: CheckoutItem[];
      customer: { name: string; email: string; phone?: string; address: string; postal_code: string; city: string; country: string; };
      totals: { subtotal: number; shipping: number; mwst: number; total: number; };
      successUrl: string; cancelUrl: string;
    };

    if (!items?.length || !customer?.email || !customer?.name) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try to read user from JWT (optional)
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      try {
        const supabaseAuth = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_ANON_KEY") ?? ""
        );
        const { data } = await supabaseAuth.auth.getUser(authHeader.replace("Bearer ", ""));
        userId = data.user?.id ?? null;
      } catch { /* guest */ }
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Create pending order + items
    const { data: order, error: orderErr } = await admin.from("shop_orders").insert({
      user_id: userId,
      customer_email: customer.email,
      customer_name: customer.name,
      customer_phone: customer.phone || null,
      shipping_address: customer.address,
      shipping_city: customer.city,
      shipping_postal_code: customer.postal_code,
      shipping_country: customer.country || "Schweiz",
      subtotal: totals.subtotal,
      shipping: totals.shipping,
      mwst: totals.mwst,
      total: totals.total,
      status: "pending",
    }).select().single();
    if (orderErr) throw orderErr;

    const itemRows = items.map(i => ({
      order_id: order.id, product_id: i.productId, product_name: i.name,
      quantity: i.quantity, unit_price: i.preis, total: i.preis * i.quantity,
    }));
    await admin.from("shop_order_items").insert(itemRows);

    // Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const line_items = items.map(i => ({
      price_data: {
        currency: "chf",
        product_data: { name: i.name },
        unit_amount: Math.round(Number(i.preis) * 100),
      },
      quantity: i.quantity,
    }));
    if (totals.shipping > 0) {
      line_items.push({
        price_data: {
          currency: "chf",
          product_data: { name: "Versand" },
          unit_amount: Math.round(Number(totals.shipping) * 100),
        },
        quantity: 1,
      });
    }
    if (totals.mwst > 0) {
      line_items.push({
        price_data: {
          currency: "chf",
          product_data: { name: "MwSt. (8.1%)" },
          unit_amount: Math.round(Number(totals.mwst) * 100),
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: customer.email,
      line_items,
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: { order_id: order.id },
    });

    await admin.from("shop_orders").update({ stripe_session_id: session.id }).eq("id", order.id);

    return new Response(JSON.stringify({ url: session.url, orderId: order.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("checkout error", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
