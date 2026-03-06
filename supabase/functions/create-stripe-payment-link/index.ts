import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
  if (!STRIPE_SECRET_KEY) {
    return new Response(JSON.stringify({ error: "STRIPE_SECRET_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { orderId, betrag, orderName, customerEmail } = body;

    if (!betrag || betrag <= 0) {
      return new Response(JSON.stringify({ error: "Ungültiger Betrag" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (betrag < 0.50) {
      return new Response(JSON.stringify({ error: "Der Mindestbetrag für eine Online-Zahlung beträgt CHF 0.50." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2025-08-27.basil",
    });

    // Check if Stripe customer exists for this email
    let customerId: string | undefined;
    if (customerEmail) {
      const existing = await stripe.customers.list({ email: customerEmail, limit: 1 });
      if (existing.data.length > 0) {
        customerId = existing.data[0].id;
      } else {
        const newCustomer = await stripe.customers.create({ email: customerEmail });
        customerId = newCustomer.id;
      }
    }

    // Create a payment link with a dynamic price
    const orderNr = (orderId || "").slice(0, 8).toUpperCase();
    const description = orderName ? `Rechnung: ${orderName} (Nr. ${orderNr})` : `Rechnung Nr. ${orderNr}`;

    // Create a Stripe Checkout Session (one-time payment)
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "chf",
            product_data: {
              name: description,
            },
            unit_amount: Math.round(betrag * 100), // in Rappen
          },
          quantity: 1,
        },
      ],
      success_url: `${req.headers.get("origin") || "https://muscio-hub.lovable.app"}/payment-success?order_id=${orderId}`,
      cancel_url: `${req.headers.get("origin") || "https://muscio-hub.lovable.app"}/auftraege/${orderId}?payment=cancelled`,
      payment_method_types: ["card"],
      metadata: {
        order_id: orderId || "",
      },
    };

    if (customerId) {
      sessionParams.customer = customerId;
    } else if (customerEmail) {
      sessionParams.customer_email = customerEmail;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
