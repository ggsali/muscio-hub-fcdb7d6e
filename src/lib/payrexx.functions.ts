import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Nach dem Bezahlen nur auf eigene Domains zurückleiten.
export function safeOrigin(raw: string): string {
  try {
    const u = new URL(raw);
    const h = u.hostname.toLowerCase();
    const ok = h === "3dmuscio.com" || h === "www.3dmuscio.com" || h === "localhost" ||
      h.endsWith(".lovable.app") || h.endsWith(".lovableproject.com");
    if (ok && (u.protocol === "https:" || h === "localhost")) return u.origin;
  } catch { /* ungültig */ }
  return "https://3dmuscio.com";
}

// Nur reiner Text: keine Links, kein HTML → keine Phishing-Inhalte in unserem Namen
const plain = (v: string | null | undefined, max: number) =>
  String(v || "").replace(/[<>]/g, "").replace(/(https?:\/\/|www\.)\S*/gi, "")
    .replace(/\S+\.(com|ch|net|org|io|de|app|ly|me)\b\S*/gi, "").trim().slice(0, max);

type Result = { url: string; error?: undefined } | { url?: undefined; error: string };

// ── Warenkorb (nur angemeldet) ─────────────────────────────────────────
const ShopInput = z.object({
  items: z.array(z.object({
    product_id: z.string().uuid(),
    name: z.string().max(300),
    quantity: z.number().int().min(1).max(99),
    optionen: z.array(z.object({ wertId: z.string().uuid() })).max(20).optional(),
  })).min(1).max(50),
  customer: z.object({ email: z.string().max(255).optional(), name: z.string().max(200).optional() }).optional(),
  gutscheinCode: z.string().trim().max(40).optional(),
  origin: z.string().max(300),
});

export const createShopCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ShopInput.parse(d))
  .handler(async ({ data, context }): Promise<Result> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createGateway } = await import("./payrexx.server");
    const sb = supabaseAdmin as any;
    const userId = context.userId;
    const userEmail = (context.claims as any)?.email as string | undefined;
    try {
      const ids = [...new Set(data.items.map((i) => i.product_id))];
      const { data: products, error: prodErr } = await sb.from("shop_products")
        .select("id, name, slug, preis, aktiv, lagerbestand, unendlich_bestand").in("id", ids);
      if (prodErr) throw prodErr;
      const productMap = new Map<string, any>((products || []).map((p: any) => [p.id, p]));

      const wertIds = [...new Set(data.items.flatMap((i) => (i.optionen || []).map((o) => o.wertId)))];
      const werteMap = new Map<string, any>();
      const optionMap = new Map<string, any>();
      if (wertIds.length) {
        const { data: werte } = await sb.from("shop_produkt_option_werte")
          .select("id, wert, preis_aufschlag, aktiv, lagerbestand, option_id").in("id", wertIds);
        for (const w of werte || []) werteMap.set(w.id, w);
        const optionIds = [...new Set((werte || []).map((w: any) => w.option_id).filter(Boolean))];
        if (optionIds.length) {
          const { data: opts } = await sb.from("shop_product_optionen").select("id, name, product_id").in("id", optionIds);
          for (const o of opts || []) optionMap.set(o.id, o);
        }
      }

      const validated = data.items.map((i) => {
        const p = productMap.get(i.product_id);
        if (!p || !p.aktiv) throw new Error(`Produkt nicht verfügbar: ${i.name}`);
        const qty = i.quantity;
        if (!p.unendlich_bestand && (p.lagerbestand ?? 0) < qty) {
          throw new Error((p.lagerbestand ?? 0) <= 0 ? `Ausverkauft: ${p.name}` : `Nur noch ${p.lagerbestand}× verfügbar: ${p.name}`);
        }
        const optionen = (i.optionen || []).map((o) => {
          const w = werteMap.get(o.wertId);
          if (!w || w.aktiv === false) throw new Error(`Option nicht verfügbar bei ${p.name}`);
          const opt = optionMap.get(w.option_id);
          if (!opt || opt.product_id !== p.id) throw new Error(`Ungültige Option bei ${p.name}`);
          if (w.lagerbestand !== null && w.lagerbestand !== undefined && w.lagerbestand < qty) throw new Error(`Ausverkauft: ${p.name} (${w.wert})`);
          return { optionId: opt.id, optionName: opt.name, wertId: w.id, wertName: w.wert, aufschlag: Number(w.preis_aufschlag || 0) };
        });
        const aufschlag = optionen.reduce((s, o) => s + o.aufschlag, 0);
        const label = optionen.length ? `${p.name} (${optionen.map((o) => `${o.optionName}: ${o.wertName}`).join(", ")})` : p.name;
        return { product_id: p.id, label, slug: p.slug, preis: Number(p.preis) + aufschlag, quantity: qty, optionen };
      });

      const subtotal = Math.round(validated.reduce((s, i) => s + i.preis * i.quantity, 0) * 100) / 100;
      if (subtotal < 0.5) throw new Error("Mindestbetrag CHF 0.50");

      // Gutschein serverseitig prüfen
      let gutscheinId: string | null = null;
      let rabatt = 0;
      const code = (data.gutscheinCode || "").toUpperCase();
      if (code) {
        const { data: g } = await sb.from("gutscheine").select("*").eq("code", code).maybeSingle();
        const heute = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Zurich" }).format(new Date());
        const ungueltig =
          !g ? "Code existiert nicht" :
          !g.aktiv ? "Code ist nicht aktiv" :
          g.gueltig_ab && heute < g.gueltig_ab ? "Code ist noch nicht gültig" :
          g.gueltig_bis && heute > g.gueltig_bis ? "Code ist abgelaufen" :
          g.max_verwendungen !== null && (g.verwendungen ?? 0) >= g.max_verwendungen ? "Code ist aufgebraucht" :
          Number(g.mindestbestellwert || 0) > subtotal ? `Mindestbestellwert CHF ${Number(g.mindestbestellwert).toFixed(2)} nicht erreicht` :
          null;
        if (ungueltig) throw new Error(`Gutschein: ${ungueltig}`);
        if (g.typ === "prozent") rabatt = Math.round(subtotal * (Number(g.wert) / 100) * 100) / 100;
        else if (g.typ === "betrag") rabatt = Math.min(Number(g.wert), subtotal);
        if (rabatt > 0) gutscheinId = g.id;
      }
      const total = Math.round((subtotal - rabatt) * 100) / 100;
      if (total < 0.5) throw new Error("Mindestbetrag CHF 0.50 – der Gutschein deckt die ganze Bestellung");

      const email = data.customer?.email || userEmail || "";
      const { data: draft, error: draftErr } = await sb.from("shop_orders").insert({
        user_id: userId, customer_email: email || "guest@pending.local",
        customer_name: data.customer?.name || "Wird beim Bezahlen erfasst",
        shipping_address: "—", shipping_city: "—", shipping_postal_code: "—", shipping_country: "Schweiz",
        subtotal, shipping: 0, mwst: 0, total, status: "pending",
      }).select("id").single();
      if (draftErr) throw draftErr;
      const orderId = draft.id as string;

      const { error: itemsErr } = await sb.from("shop_order_items").insert(validated.map((v) => ({
        order_id: orderId, product_id: v.product_id, product_slug: v.slug, product_name: v.label,
        quantity: v.quantity, unit_price: v.preis, total: v.preis * v.quantity, optionen: v.optionen,
      })));
      if (itemsErr) throw itemsErr;

      const origin = safeOrigin(data.origin);
      const gw = await createGateway({
        amountChf: total,
        purpose: `Webshop-Bestellung #${orderId.substring(0, 8).toUpperCase()}`,
        referenceId: `shop:${orderId}${gutscheinId ? `:${gutscheinId}` : ""}`,
        successUrl: `${origin}/payment-success?ref=${orderId.substring(0, 8)}`,
        cancelUrl: `${origin}/shop`,
        email, adresse: true,
      });
      await sb.from("shop_orders").update({ stripe_session_id: `payrexx:${gw.id}` }).eq("id", orderId);
      return { url: gw.link };
    } catch (err: any) {
      const msg = err?.message || "Unbekannter Fehler";
      console.error("[shop checkout]", msg);
      const fachlich = /^(Gutschein:|Ausverkauft|Nur noch|Mindestbetrag|Mindestbestellwert|Produkt nicht verfügbar|Option nicht verfügbar|Ungültige)/.test(msg);
      return { error: fachlich ? msg : "Bezahlung konnte nicht gestartet werden" };
    }
  });

// ── Gutschein kaufen (öffentlich) ──────────────────────────────────────
const GiftInput = z.object({
  betrag: z.number().min(10).max(1000),
  empfaenger_email: z.string().trim().email().max(255).nullable().optional(),
  empfaenger_name: z.string().max(200).nullable().optional(),
  nachricht: z.string().max(1000).nullable().optional(),
  origin: z.string().max(300),
});

export const createGiftCheckout = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => GiftInput.parse(d))
  .handler(async ({ data }): Promise<Result> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createGateway } = await import("./payrexx.server");
    const sb = supabaseAdmin as any;
    try {
      const betrag = Math.round(data.betrag * 100) / 100;
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      const rnd = new Uint8Array(12);
      crypto.getRandomValues(rnd);
      let suffix = "";
      for (let i = 0; i < 12; i++) suffix += chars[rnd[i] % chars.length];
      const gueltigBis = new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10);
      // Gutschein wird inaktiv angelegt und erst nach bestätigter Zahlung aktiviert.
      const { data: row, error } = await sb.from("gutscheine").insert({
        code: `GESCHENK-${suffix}`, typ: "betrag", wert: betrag, mindestbestellwert: 0, max_verwendungen: 1,
        gueltig_bis: gueltigBis, grund: "Gutschein-Kauf über Website (Zahlung ausstehend)", aktiv: false,
        notiz: JSON.stringify({
          kauf: "pending",
          empfaenger_email: (data.empfaenger_email || "").trim(),
          empfaenger_name: plain(data.empfaenger_name, 80),
          nachricht: plain(data.nachricht, 300),
        }),
      }).select("id").single();
      if (error) throw error;
      const origin = safeOrigin(data.origin);
      const gw = await createGateway({
        amountChf: betrag,
        purpose: `3DMuscio Gutschein CHF ${betrag.toFixed(2)}`,
        referenceId: `gift:${row.id}`,
        successUrl: `${origin}/gutschein?erfolg=1`,
        cancelUrl: `${origin}/gutschein`,
      });
      return { url: gw.link };
    } catch (e: any) {
      console.error("[gift checkout]", e?.message);
      return { error: "Bezahlung konnte nicht gestartet werden" };
    }
  });

// ── Zahlungslink für einen Auftrag (nur Admin) ─────────────────────────
export const createOrderPaymentLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    orderId: z.string().uuid(),
    orderName: z.string().max(300).optional(),
    customerEmail: z.string().max(255).optional(),
  }).parse(d))
  .handler(async ({ data, context }): Promise<Result> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) return { error: "Keine Berechtigung" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createGateway } = await import("./payrexx.server");
    const sb = supabaseAdmin as any;

    // Betrag: neueste offene Rechnung, sonst Auftragstotal minus bereits bezahlt.
    const { data: ord } = await sb.from("orders").select("umsatz_total").eq("id", data.orderId).maybeSingle();
    const total = Number(ord?.umsatz_total || 0);
    const { data: bills } = await sb.from("bills").select("betrag, bezahlt, created_at")
      .eq("order_id", data.orderId).order("created_at", { ascending: false });
    const unpaid = (bills || []).filter((b: any) => !b.bezahlt);
    let betrag = 0;
    if (unpaid.length) betrag = Number(unpaid[0].betrag || 0);
    else if (total > 0) {
      const bezahlt = (bills || []).filter((b: any) => b.bezahlt).reduce((s: number, b: any) => s + Number(b.betrag || 0), 0);
      betrag = Math.max(0, total - bezahlt);
      if (betrag <= 0) betrag = total;
    }
    if (!betrag || betrag < 0.5) return { error: "Der Mindestbetrag für eine Online-Zahlung beträgt CHF 0.50." };

    const nr = data.orderId.slice(0, 8).toUpperCase();
    try {
      const gw = await createGateway({
        amountChf: betrag,
        purpose: data.orderName ? `Rechnung: ${data.orderName} (Nr. ${nr})` : `Rechnung Nr. ${nr}`,
        referenceId: `order:${data.orderId}`,
        successUrl: `https://3dmuscio.com/payment-success?order_id=${data.orderId}`,
        cancelUrl: "https://3dmuscio.com",
        email: data.customerEmail || undefined,
      });
      return { url: gw.link };
    } catch (e: any) {
      return { error: e?.message || "Zahlungslink konnte nicht erstellt werden" };
    }
  });
