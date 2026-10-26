import { createFileRoute } from "@tanstack/react-router";

// Payrexx ruft diese Adresse bei jeder Transaktionsänderung auf.
// Dem Inhalt des Aufrufs wird NICHT vertraut: wir lesen nur die Transaktions-ID
// und holen Status, Betrag, Referenz und Kontaktdaten direkt bei Payrexx ab.

const escH = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

async function readTransactionId(request: Request): Promise<number | null> {
  const raw = await request.text();
  let id: unknown;
  try { id = JSON.parse(raw)?.transaction?.id; } catch {
    id = new URLSearchParams(raw).get("transaction[id]");
  }
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function kontakt(tx: any) {
  const c = tx?.contact || {};
  const name = [c.firstname, c.lastname].filter(Boolean).join(" ").trim();
  return {
    name: name || null,
    vorname: c.firstname || "",
    nachname: c.lastname || "",
    email: c.email || null,
    phone: c.phone || null,
    street: c.street || null,
    zip: c.zip || c.postcode || null,
    place: c.place || null,
    country: c.countryISO || c.country || "CH",
  };
}

async function findeOderErstelleKunde(sb: any, k: ReturnType<typeof kontakt>, notiz: string) {
  if (!k.email) return null;
  const { data: exist } = await sb.from("customers").select("id").eq("email", k.email).maybeSingle();
  if (exist) return exist.id as string;
  const { data: neu } = await sb.from("customers").insert({
    name: k.nachname || k.name || k.email, vorname: k.vorname, email: k.email, telefon: k.phone,
    strasse: k.street, plz: k.zip, ort: k.place, land: k.country || "Schweiz", notizen: notiz,
  }).select("id").single();
  return (neu?.id as string) ?? null;
}

async function shopBezahlt(sb: any, tx: any, orderId: string, gutscheinId: string | undefined, betrag: number) {
  const { data: so } = await sb.from("shop_orders").select("id, status, subtotal").eq("id", orderId).maybeSingle();
  if (!so || so.status === "paid") return;
  const k = kontakt(tx);
  const email = k.email || "noemail@webshop.local";
  const fullName = k.name || "Webshop-Kunde";
  await sb.from("shop_orders").update({
    status: "paid", paid_at: new Date().toISOString(), customer_email: email, customer_name: fullName,
    customer_phone: k.phone, shipping_address: k.street || "—", shipping_city: k.place || "—",
    shipping_postal_code: k.zip || "—", shipping_country: k.country || "Schweiz", total: betrag,
  }).eq("id", orderId);

  if (gutscheinId) {
    const rabatt = Math.max(0, Math.round((Number(so.subtotal) - betrag) * 100) / 100);
    await sb.from("gutschein_verwendungen").insert({ gutschein_id: gutscheinId, shop_order_id: orderId, rabatt_betrag: rabatt });
    const { data: g } = await sb.from("gutscheine").select("verwendungen").eq("id", gutscheinId).maybeSingle();
    await sb.from("gutscheine").update({ verwendungen: (g?.verwendungen ?? 0) + 1 }).eq("id", gutscheinId);
  }

  const customerId = await findeOderErstelleKunde(sb, k, "Automatisch aus Webshop-Bestellung importiert");
  const { data: items } = await sb.from("shop_order_items")
    .select("product_id, product_name, quantity, unit_price, total, optionen").eq("order_id", orderId);
  const desc = (items || []).map((i: any) => `${i.quantity}× ${i.product_name} (CHF ${Number(i.total).toFixed(2)})`).join("\n");
  const nr = orderId.substring(0, 8);
  const { data: newOrder } = await sb.from("orders").insert({
    customer_id: customerId, name: `Webshop-Bestellung #${nr}`, beschreibung: desc, status: "Offen",
    source: "website-shop", umsatz_total: betrag, kosten_total: 0, gewinn_total: betrag, marge: 100,
  }).select("id").single();
  if (newOrder) {
    await sb.from("shop_orders").update({ order_id: newOrder.id }).eq("id", orderId);
    await sb.from("order_status_log").insert({ order_id: newOrder.id, status: "Offen", notiz: `Aus Webshop importiert. Payrexx #${tx.id}` });
  }

  for (const it of (items || []) as any[]) {
    if (it.product_id) {
      const { data: p } = await sb.from("shop_products").select("id, lagerbestand, unendlich_bestand").eq("id", it.product_id).maybeSingle();
      if (p && !p.unendlich_bestand) await sb.from("shop_products").update({ lagerbestand: Math.max(0, (p.lagerbestand || 0) - it.quantity) }).eq("id", p.id);
    }
    for (const opt of (it.optionen || []) as any[]) {
      if (!opt?.wertId) continue;
      const { data: w } = await sb.from("shop_produkt_option_werte").select("id, lagerbestand").eq("id", opt.wertId).maybeSingle();
      if (w && w.lagerbestand !== null && w.lagerbestand !== undefined) {
        await sb.from("shop_produkt_option_werte").update({ lagerbestand: Math.max(0, Number(w.lagerbestand) - it.quantity) }).eq("id", w.id);
      }
    }
  }

  await sb.functions.invoke("send-transactional-email", { body: {
    templateName: "zahlung-bestaetigung", recipientEmail: email, idempotencyKey: `shop-payment-payrexx-${tx.id}`,
    templateData: { customerName: fullName, orderName: `Webshop-Bestellung #${nr}`, orderNr: nr.toUpperCase(), amountFormatted: `CHF ${betrag.toFixed(2)}` },
  } }).catch((e: unknown) => console.error("[payrexx-webhook] mail", e));
}

async function auftragBezahlt(sb: any, tx: any, orderId: string, betrag: number) {
  const marker = `Payrexx #${tx.id}`;
  const { data: schon } = await sb.from("order_status_log").select("id").eq("order_id", orderId).ilike("notiz", `%${marker}%`).limit(1);
  if (schon?.length) return;
  const today = new Date().toISOString().split("T")[0];
  await sb.from("bills").update({ bezahlt: true, bezahlt_am: today }).eq("order_id", orderId).eq("bezahlt", false);
  await sb.from("orders").update({ status: "Bezahlt" }).eq("id", orderId);
  await sb.from("order_status_log").insert({ order_id: orderId, status: "Bezahlt", notiz: `Online-Zahlung via Payrexx (CHF ${betrag.toFixed(2)}) – ${marker}` });

  const { data: order } = await sb.from("orders").select("*, customers(*)").eq("id", orderId).maybeSingle();
  const c = order?.customers;
  if (c?.email) {
    const nr = orderId.slice(0, 8).toUpperCase();
    await sb.functions.invoke("send-transactional-email", { body: {
      templateName: "zahlung-bestaetigung", recipientEmail: c.email, idempotencyKey: `payment-confirmation-payrexx-${tx.id}`,
      templateData: {
        customerName: [c.vorname, c.name].filter(Boolean).join(" ") || c.name || "",
        orderName: order.name || order.beschreibung || `Auftrag ${nr}`, orderNr: nr, amountFormatted: `CHF ${betrag.toFixed(2)}`,
      },
    } }).catch((e: unknown) => console.error("[payrexx-webhook] mail", e));
  }
}

async function gutscheinBezahlt(sb: any, tx: any, id: string) {
  const { data: g } = await sb.from("gutscheine").select("*").eq("id", id).maybeSingle();
  if (!g || g.aktiv) return;
  let info: any = {};
  try { info = JSON.parse(g.notiz || "{}"); } catch { /* leer */ }
  if (info.kauf !== "pending") return;
  const k = kontakt(tx);
  const empfaenger = (info.empfaenger_email || "").trim() || k.email || "";
  await sb.from("gutscheine").update({
    aktiv: true, grund: "Gutschein-Kauf über Website",
    notiz: `Payrexx #${tx.id}${empfaenger ? ` · an ${empfaenger}` : ""}`,
  }).eq("id", id);

  const resendKey = process.env["RESEND_API_KEY"];
  if (!empfaenger || !resendKey) return;
  const betrag = Number(g.wert);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "3DMuscio <noreply@3dmuscio.com>", to: [empfaenger],
      subject: `Dein 3DMuscio Gutschein: CHF ${betrag.toFixed(2)}`,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#111;">
        <h1 style="color:#FF5A00;">Dein 3DMuscio Gutschein</h1>
        <p>${info.empfaenger_name ? `Hallo ${escH(info.empfaenger_name)}` : "Hallo"}</p>
        ${info.nachricht ? `<p style="white-space:pre-wrap;">${escH(info.nachricht)}</p>` : ""}
        <div style="border:2px dashed #FF5A00;border-radius:12px;padding:20px;text-align:center;margin:24px 0;">
          <div style="font-size:12px;letter-spacing:2px;color:#666;text-transform:uppercase;">Gutschein-Code</div>
          <div style="font-size:28px;font-weight:bold;letter-spacing:3px;margin-top:8px;">${escH(g.code)}</div>
          <div style="font-size:14px;color:#666;margin-top:8px;">CHF ${betrag.toFixed(2)} Guthaben</div>
        </div>
        <p style="color:#444;font-size:14px;">Gültig bis ${new Date(g.gueltig_bis).toLocaleDateString("de-CH")} · einlösbar im Shop und im Online-Kalkulator.</p>
        <p style="margin-top:24px;"><a href="https://3dmuscio.com/kalkulator-online" style="background:#FF5A00;color:#fff;padding:12px 20px;text-decoration:none;border-radius:8px;">Jetzt einlösen &rarr;</a></p>
      </div>`,
    }),
  });
  if (!res.ok) console.error("[payrexx-webhook] gutschein mail", await res.text());
}

async function stadtmodellBezahlt(sb: any, tx: any, id: string) {
  const { data: row } = await sb.from("stadtmodell_bestellungen").select("status").eq("id", id).maybeSingle();
  if (!row || row.status === "bezahlt") return;
  const { data: files } = await sb.storage.from("stadtmodelle").list("", { search: `${id}.stl` });
  const ok = (files || []).some((f: any) => f.name === `${id}.stl`);
  const k = kontakt(tx);
  await sb.from("stadtmodell_bestellungen").update({
    status: ok ? "bezahlt" : "fehler", fehler: ok ? null : "STL-Datei fehlt nach Zahlung",
    kunde_name: k.name, kunde_email: k.email,
    lieferadresse: [k.name, k.street, [k.zip, k.place].filter(Boolean).join(" "), k.country, k.phone].filter(Boolean).join("\n") || null,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
}

export const Route = createFileRoute("/api/public/payrexx-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const txId = await readTransactionId(request);
        if (!txId) return new Response("ignored", { status: 200 });
        const { getTransaction } = await import("@/lib/payrexx.server");
        let tx: any;
        try { tx = await getTransaction(txId); } catch {
          return new Response("unknown transaction", { status: 200 });
        }
        if (tx?.status !== "confirmed") return new Response("ok", { status: 200 });

        const ref = String(tx.referenceId || tx.invoice?.referenceId || "");
        const [typ, id, extra] = ref.split(":");
        const uuid = /^[0-9a-f-]{36}$/i;
        if (!uuid.test(id || "")) return new Response("ok", { status: 200 });
        const betrag = Number(tx.amount ?? tx.invoice?.amount ?? 0) / 100;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const sb = supabaseAdmin as any;
        try {
          if (typ === "shop") await shopBezahlt(sb, tx, id, extra && uuid.test(extra) ? extra : undefined, betrag);
          else if (typ === "order") await auftragBezahlt(sb, tx, id, betrag);
          else if (typ === "gift") await gutscheinBezahlt(sb, tx, id);
          else if (typ === "stadt") await stadtmodellBezahlt(sb, tx, id);
        } catch (e) {
          console.error("[payrexx-webhook]", ref, e);
          return new Response("error", { status: 500 }); // Payrexx versucht es erneut
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});
