import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { MASSSTAEBE, MATERIALIEN, MODELL_MAX_MM, MODELL_MIN_MM, QUELLE, berechnePreis, modellMm, type MaterialKey } from "./stadtmodell";

const Input = z.object({
  environment: z.enum(["sandbox", "live"]),
  lat: z.number().gt(45.7).lt(47.9),
  lon: z.number().gt(5.9).lt(10.6),
  kantenlaenge_m: z.number().int().min(100).max(500),
  massstab: z.number().refine((m) => (MASSSTAEBE as readonly number[]).includes(m)),
  sockel_mm: z.number().min(2).max(15),
  material: z.enum(Object.keys(MATERIALIEN) as [MaterialKey, ...MaterialKey[]]),
  origin: z.string().url(),
});

function form(obj: Record<string, unknown>, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) v.forEach((x, i) => (typeof x === "object" ? form(x as any, `${key}[${i}]`, out) : out.append(`${key}[${i}]`, String(x))));
    else if (typeof v === "object") form(v as any, key, out);
    else out.append(key, String(v));
  }
  return out;
}

export const createStadtmodellCheckout = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const mm = modellMm(data.kantenlaenge_m, data.massstab);
    if (mm < MODELL_MIN_MM || mm > MODELL_MAX_MM) throw new Error(`Modellgrösse muss zwischen ${MODELL_MIN_MM} und ${MODELL_MAX_MM} mm liegen`);
    const preis = berechnePreis(data.kantenlaenge_m, data.massstab, data.sockel_mm, data.material);
    const origin = /^https:\/\/([a-z0-9-]+\.)*(3dmuscio\.com|lovable\.app)$|^http:\/\/localhost(:\d+)?$/.test(data.origin) ? data.origin : "https://3dmuscio.com";

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("stadtmodell_bestellungen").insert({
      lat: data.lat, lon: data.lon, kantenlaenge_m: data.kantenlaenge_m, massstab: data.massstab,
      sockel_mm: data.sockel_mm, material: data.material, modell_mm: mm, preis,
    }).select("id").single();
    if (error) throw new Error("Bestellung konnte nicht angelegt werden");
    const path = `${row.id}.stl`;
    const { data: up, error: upErr } = await supabaseAdmin.storage.from("stadtmodelle").createSignedUploadUrl(path);
    if (upErr || !up) throw new Error("Upload konnte nicht vorbereitet werden");

    const conn = data.environment === "sandbox" ? process.env.STRIPE_SANDBOX_API_KEY : process.env.STRIPE_LIVE_API_KEY;
    const lovKey = process.env.LOVABLE_API_KEY;
    if (!conn || !lovKey) throw new Error("Zahlung ist nicht konfiguriert");
    const name = `Stadtmodell ${data.kantenlaenge_m}×${data.kantenlaenge_m} m, 1:${data.massstab} (${mm}×${mm} mm), ${MATERIALIEN[data.material].label}`;
    const body = form({
      mode: "payment",
      ui_mode: "embedded_page",
      return_url: `${origin}/stadtmodell?erfolg=1`,
      line_items: [{ quantity: 1, price_data: { currency: "chf", unit_amount: Math.round(preis * 100),
        product_data: { name, description: QUELLE, tax_code: "txcd_99999999" } } }],
      shipping_address_collection: { allowed_countries: ["CH", "LI"] },
      phone_number_collection: { enabled: true },
      payment_intent_data: { description: name },
      metadata: { stadtmodell_id: row.id },
    });
    const res = await fetch("https://connector-gateway.lovable.dev/stripe/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Stripe-Version": "2026-03-25.dahlia",
        "X-Connection-Api-Key": conn,
        "Lovable-API-Key": lovKey,
      },
      body,
    });
    const session = await res.json();
    if (!res.ok) {
      console.error("[stadtmodell checkout]", session);
      await supabaseAdmin.from("stadtmodell_bestellungen").update({ status: "fehler", fehler: "Checkout fehlgeschlagen" }).eq("id", row.id);
      throw new Error("Zahlung konnte nicht gestartet werden");
    }
    await supabaseAdmin.from("stadtmodell_bestellungen").update({ stripe_session_id: session.id, stl_path: path }).eq("id", row.id);
    return { clientSecret: session.client_secret as string, path, uploadToken: up.token, preis };
  });
