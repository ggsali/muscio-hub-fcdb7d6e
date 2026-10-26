// Payrexx Gateway API (https://developers.payrexx.com) – nur fetch, kein SDK.
// Zugangsdaten: PAYREXX_INSTANCE (Teil vor .payrexx.com) und PAYREXX_API_SECRET.

function form(obj: Record<string, unknown>, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) v.forEach((x, i) => (typeof x === "object" ? form(x as any, `${key}[${i}]`, out) : out.append(`${key}[${i}]`, String(x))));
    else if (typeof v === "object") form(v as any, key, out);
    else out.append(key, String(v));
  }
  return out;
}

async function call(method: "GET" | "POST", path: string, body?: Record<string, unknown>) {
  const instance = (Deno.env.get("PAYREXX_INSTANCE") || "").trim().replace(/^https?:\/\//, "").replace(/\.payrexx\.com.*$/, "");
  const secret = Deno.env.get("PAYREXX_API_SECRET") || "";
  if (!instance || !secret) throw new Error("Zahlung ist nicht konfiguriert");
  const res = await fetch(`https://api.payrexx.com/v1.0/${path}?instance=${encodeURIComponent(instance)}`, {
    method,
    headers: { "X-API-KEY": secret, ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: body ? form(body).toString() : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.status !== "success" || !json?.data?.[0]) {
    console.error("[payrexx]", path, res.status, json?.message || json);
    throw new Error("Zahlung konnte nicht gestartet werden");
  }
  return json.data[0];
}

export interface GatewayInput {
  amountChf: number;
  purpose: string;
  referenceId: string;
  successUrl: string;
  cancelUrl: string;
  email?: string;
  /** Adressfelder als Pflichtfelder auf der Zahlungsseite abfragen. */
  adresse?: boolean;
  prefill?: { forename?: string; surname?: string; street?: string; postcode?: string; place?: string; phone?: string };
}

export async function createGateway(i: GatewayInput): Promise<{ id: number; link: string }> {
  const amount = Math.round(i.amountChf * 100);
  if (amount < 50) throw new Error("Mindestbetrag CHF 0.50");
  const p = i.prefill || {};
  const fields: Record<string, unknown> = {
    email: { mandatory: 1, defaultValue: i.email },
    forename: { mandatory: i.adresse ? 1 : 0, defaultValue: p.forename },
    surname: { mandatory: i.adresse ? 1 : 0, defaultValue: p.surname },
  };
  if (i.adresse) {
    fields.street = { mandatory: 1, defaultValue: p.street };
    fields.postcode = { mandatory: 1, defaultValue: p.postcode };
    fields.place = { mandatory: 1, defaultValue: p.place };
    fields.country = { mandatory: 1, defaultValue: "CH" };
    fields.phone = { mandatory: 0, defaultValue: p.phone };
  }
  const g = await call("POST", "Gateway/", {
    amount,
    currency: "CHF",
    purpose: i.purpose.slice(0, 200),
    referenceId: i.referenceId,
    successRedirectUrl: i.successUrl,
    failedRedirectUrl: i.cancelUrl,
    cancelRedirectUrl: i.cancelUrl,
    language: "DE",
    skipResultPage: 1,
    fields,
  });
  return { id: Number(g.id), link: String(g.link) };
}
