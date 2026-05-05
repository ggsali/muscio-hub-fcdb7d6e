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
    // ---- AUTH: require admin ----
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roleRow } = await admin
      .from("user_roles").select("role")
      .eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { orderId, orderName, customerEmail } = body;

    if (!orderId || typeof orderId !== "string") {
      return new Response(JSON.stringify({ error: "orderId erforderlich" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Re-fetch authoritative amount from DB (sum unpaid bills, fallback to order umsatz_total)
    let betrag = 0;
    const { data: bills } = await admin
      .from("bills").select("betrag, bezahlt").eq("order_id", orderId);
    if (bills && bills.length > 0) {
      betrag = bills.filter((b: any) => !b.bezahlt).reduce((s: number, b: any) => s + Number(b.betrag || 0), 0);
    }
    if (!betrag || betrag <= 0) {
      const { data: ord } = await admin
        .from("orders").select("umsatz_total").eq("id", orderId).maybeSingle();
      betrag = Number(ord?.umsatz_total || 0);
    }

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
      success_url: `https://3dmuscio.com/payment-success?order_id=${orderId}`,
      cancel_url: `https://3dmuscio.com/auftraege/${orderId}?payment=cancelled`,
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
