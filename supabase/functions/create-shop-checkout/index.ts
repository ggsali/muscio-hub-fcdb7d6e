import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface InOption {
  optionId: string;
  optionName?: string;
  wertId: string;
  wertName?: string;
}

interface InItem {
  product_id: string;
  name: string;
  preis: number;
  quantity: number;
  slug: string;
  optionen?: InOption[];
}


interface InCustomer {
  email?: string;
  name?: string;
  phone?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  country?: string;
}

const countryNameToIso = (c?: string): string | undefined => {
  if (!c) return undefined;
  const t = c.trim().toLowerCase();
  if (t.length === 2) return t.toUpperCase();
  if (["schweiz", "swiss", "switzerland", "suisse", "svizzera"].includes(t)) return "CH";
  if (["deutschland", "germany"].includes(t)) return "DE";
  if (["österreich", "oesterreich", "austria"].includes(t)) return "AT";
  if (["liechtenstein"].includes(t)) return "LI";
  return undefined;
};

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string }
): Promise<string | undefined> {
  if (!options.email && !options.userId) return undefined;
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }

  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length) return found.data[0].id;
  }

  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (options.userId && customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }

  if (!options.email) return undefined;

  const created = await stripe.customers.create({
    email: options.email,
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const items = (body?.items || []) as InItem[];
    const inCustomer = (body?.customer || null) as InCustomer | null;
    const environment = (body?.environment || "sandbox") as StripeEnv;
    if (!["sandbox", "live"].includes(environment)) {
      throw new Error("Invalid environment");
    }

    if (!Array.isArray(items) || items.length === 0) throw new Error("Warenkorb leer");
    if (items.length > 50) throw new Error("Zu viele Positionen");

    const auth = req.headers.get("Authorization");
    let userEmail: string | undefined;
    let userId: string | undefined;
    if (auth?.startsWith("Bearer ")) {
      const { data } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
      if (data.user) {
        userEmail = data.user.email ?? undefined;
        userId = data.user.id;
      }
    }

    const ids = [...new Set(items.map((i) => i.product_id))];
    const { data: products, error: prodErr } = await supabase
      .from("shop_products")
      .select("id, name, slug, preis, aktiv, lagerbestand, unendlich_bestand, stripe_price_id")
      .in("id", ids);
    if (prodErr) throw prodErr;
    const productMap = new Map(products?.map((p) => [p.id, p]) || []);

    // Optionen serverseitig validieren (Aufschläge dürfen nicht vom Client kommen)
    const wertIds = [
      ...new Set(items.flatMap((i) => (i.optionen || []).map((o) => o.wertId)).filter(Boolean)),
    ];
    const werteMap = new Map<string, any>();
    const optionMap = new Map<string, any>();
    if (wertIds.length > 0) {
      const { data: werte, error: werteErr } = await supabase
        .from("shop_produkt_option_werte")
        .select("id, wert, preis_aufschlag, aktiv, lagerbestand, option_id")
        .in("id", wertIds);
      if (werteErr) throw werteErr;
      for (const w of werte || []) werteMap.set(w.id, w);

      const optionIds = [...new Set((werte || []).map((w: any) => w.option_id).filter(Boolean))];
      if (optionIds.length > 0) {
        const { data: opts, error: optErr } = await supabase
          .from("shop_product_optionen")
          .select("id, name, product_id, pflichtfeld")
          .in("id", optionIds);
        if (optErr) throw optErr;
        for (const o of opts || []) optionMap.set(o.id, o);
      }
    }

    const validated = items.map((i) => {
      const p = productMap.get(i.product_id);
      if (!p || !p.aktiv) throw new Error(`Produkt nicht verfügbar: ${i.name}`);
      const qty = Math.max(1, Math.min(99, Math.floor(i.quantity)));
      if (!p.unendlich_bestand && (p.lagerbestand ?? 0) < qty) {
        throw new Error(
          (p.lagerbestand ?? 0) <= 0
            ? `Ausverkauft: ${p.name}`
            : `Nur noch ${p.lagerbestand}× verfügbar: ${p.name}`
        );
      }

      const optionen = (i.optionen || []).map((o) => {
        const w = werteMap.get(o.wertId);
        if (!w || w.aktiv === false) throw new Error(`Option nicht verfügbar bei ${p.name}`);
        const opt = optionMap.get(w.option_id);
        if (!opt || opt.product_id !== p.id) throw new Error(`Ungültige Option bei ${p.name}`);
        if (w.lagerbestand !== null && w.lagerbestand !== undefined && w.lagerbestand < qty) {
          throw new Error(`Ausverkauft: ${p.name} (${w.wert})`);
        }
        return {
          optionId: opt.id,
          optionName: opt.name,
          wertId: w.id,
          wertName: w.wert,
          aufschlag: Number(w.preis_aufschlag || 0),
        };
      });

      const aufschlag = optionen.reduce((s, o) => s + o.aufschlag, 0);
      const label = optionen.length > 0
        ? `${p.name} (${optionen.map((o) => `${o.optionName}: ${o.wertName}`).join(", ")})`
        : p.name;

      return {
        product_id: p.id,
        name: p.name,
        label,
        slug: p.slug,
        preis: Number(p.preis) + aufschlag,
        quantity: qty,
        // Produkt-Preis-IDs können Optionsaufschläge nicht abbilden
        stripe_price_id: optionen.length > 0 ? null : p.stripe_price_id,
        optionen,
      };
    });

    const subtotal = validated.reduce((s, i) => s + i.preis * i.quantity, 0);
    if (subtotal < 0.5) throw new Error("Mindestbetrag CHF 0.50");

    const { data: draft, error: draftErr } = await supabase.from("shop_orders").insert({
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

    const { error: itemsErr } = await supabase.from("shop_order_items").insert(
      validated.map((v) => ({
        order_id: orderId,
        product_id: v.product_id,
        product_slug: v.slug,
        product_name: v.label,
        quantity: v.quantity,
        unit_price: v.preis,
        total: v.preis * v.quantity,
        optionen: v.optionen,
      }))
    );
    if (itemsErr) throw itemsErr;


    const stripe = createStripeClient(environment);
    const origin = req.headers.get("origin") || "https://3dmuscio.com";

    const effectiveEmail = inCustomer?.email || userEmail;
    const customerId = await resolveOrCreateCustomer(stripe, {
      email: effectiveEmail,
      userId,
    });

    const iso = countryNameToIso(inCustomer?.country);
    if (customerId && inCustomer?.address) {
      await stripe.customers.update(customerId, {
        name: inCustomer.name || undefined,
        phone: inCustomer.phone || undefined,
        address: {
          line1: inCustomer.address,
          city: inCustomer.city || undefined,
          postal_code: inCustomer.postal_code || undefined,
          country: iso,
        },
        shipping: inCustomer.name
          ? {
              name: inCustomer.name,
              phone: inCustomer.phone || undefined,
              address: {
                line1: inCustomer.address,
                city: inCustomer.city || undefined,
                postal_code: inCustomer.postal_code || undefined,
                country: iso,
              },
            }
          : undefined,
      });
    }

    const lineItems = await Promise.all(
      validated.map(async (v) => {
        if (v.stripe_price_id) {
          const prices = await stripe.prices.list({ lookup_keys: [v.stripe_price_id], limit: 1 });
          if (prices.data.length > 0) {
            return { price: prices.data[0].id, quantity: v.quantity };
          }
        }
        return {
          quantity: v.quantity,
          price_data: {
            currency: "chf",
            unit_amount: Math.round(v.preis * 100),
            product_data: { name: v.label },
          },
        };
      })
    );

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      ui_mode: "embedded_page",
      line_items: lineItems,
      ...(customerId
        ? {
            customer: customerId,
            customer_update: { shipping: "auto", address: "auto", name: "auto" },
          }
        : { customer_email: effectiveEmail }),
      shipping_address_collection: { allowed_countries: ["CH", "LI", "DE", "AT"] },
      phone_number_collection: { enabled: true },
      automatic_tax: { enabled: true },
      return_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        shop_order_id: orderId,
        source: "website-shop",
        ...(userId && { userId }),
      },
      payment_intent_data: {
        description: `Webshop-Bestellung #${orderId.substring(0, 8)}`,
        metadata: {
          shop_order_id: orderId,
          ...(userId && { userId }),
        },
      },
    } as any);

    await supabase.from("shop_orders").update({ stripe_session_id: session.id }).eq("id", orderId);

    return new Response(JSON.stringify({ clientSecret: session.client_secret, order_id: orderId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[checkout] Fehler:", err?.message, err?.stack);
    return new Response(
      JSON.stringify({ error: err?.message || "Unbekannter Fehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
