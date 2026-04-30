import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface InItem { product_id: string; name: string; preis: number; quantity: number; slug: string; }

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sbAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const body = await req.json();
    const items = (body?.items || []) as InItem[];
    if (!Array.isArray(items) || items.length === 0) throw new Error("Warenkorb leer");
    if (items.length > 50) throw new Error("Zu viele Positionen");

    // Best-effort user lookup (shop is guest-friendly)
    let userEmail: string | undefined;
    let userId: string | undefined;
    const auth = req.headers.get("Authorization");
    if (auth?.startsWith("Bearer ")) {
      const { data } = await sbAdmin.auth.getUser(auth.replace("Bearer ", ""));
      if (data.user) { userEmail = data.user.email ?? undefined; userId = data.user.id; }
    }

    // Re-validate prices server-side from DB to prevent tampering
    const ids = [...new Set(items.map(i => i.product_id))];
    const { data: products, error: prodErr } = await sbAdmin
      .from("shop_products").select("id, name, slug, preis, aktiv, lagerbestand, unendlich_bestand").in("id", ids);
    if (prodErr) throw prodErr;
    const productMap = new Map(products?.map(p => [p.id, p]) || []);

    const validated = items.map(i => {
      const p = productMap.get(i.product_id);
      if (!p || !p.aktiv) throw new Error(`Produkt nicht verfügbar: ${i.name}`);
      if (!p.unendlich_bestand && p.lagerbestand <= 0) throw new Error(`Ausverkauft: ${p.name}`);
      const qty = Math.max(1, Math.min(99, Math.floor(i.quantity)));
      return {
        product_id: p.id, name: p.name, slug: p.slug,
        preis: Number(p.preis), quantity: qty,
      };
    });

    const subtotal = validated.reduce((s, i) => s + i.preis * i.quantity, 0);
    if (subtotal < 0.5) throw new Error("Mindestbetrag CHF 0.50");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
    const origin = req.headers.get("origin") || "https://3dmuscio.com";

    // Pre-create shop_orders draft to track via metadata
    const { data: draft, error: draftErr } = await sbAdmin.from("shop_orders").insert({
      user_id: userId ?? null,
      customer_email: userEmail || "guest@pending.local",
      customer_name: "Wird beim Checkout erfasst",
      shipping_address: "—",
      shipping_city: "—",
      shipping_postal_code: "—",
      shipping_country: "Schweiz",
      subtotal,
      shipping: 0,
      mwst: 0,
      total: subtotal,
      status: "pending",
    }).select("id").single();
    if (draftErr) throw draftErr;
    const orderId = draft.id;

    await sbAdmin.from("shop_order_items").insert(
      validated.map(v => ({
        order_id: orderId,
        product_id: v.product_id,
        product_slug: v.slug,
        product_name: v.name,
        quantity: v.quantity,
        unit_price: v.preis,
        total: v.preis * v.quantity,
      }))
    );

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: userEmail,
      line_items: validated.map(v => ({
        quantity: v.quantity,
        price_data: {
          currency: "chf",
          unit_amount: Math.round(v.preis * 100),
          product_data: { name: v.name },
        },
      })),
      shipping_address_collection: { allowed_countries: ["CH", "LI", "DE", "AT"] },
      phone_number_collection: { enabled: true },
      success_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/shop`,
      metadata: { shop_order_id: orderId, source: "website-shop" },
    });

    await sbAdmin.from("shop_orders").update({ stripe_session_id: session.id }).eq("id", orderId);

    return new Response(JSON.stringify({ url: session.url, order_id: orderId }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("create-shop-checkout error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Unbekannter Fehler" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
