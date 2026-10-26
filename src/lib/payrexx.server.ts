// Payrexx Gateway API für Server-Funktionen und Server-Routen (Worker-Laufzeit).
// Zugangsdaten: PAYREXX_INSTANCE und PAYREXX_API_SECRET (nur serverseitig).

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

export async function payrexxCall(method: "GET" | "POST", path: string, body?: Record<string, unknown>) {
  const instance = (process.env["PAYREXX_INSTANCE"] || "").trim().replace(/^https?:\/\//, "").replace(/\.payrexx\.com.*$/, "");
  const secret = process.env["PAYREXX_API_SECRET"] || "";
  if (!instance || !secret) throw new Error("Zahlung ist nicht konfiguriert");
  const res = await fetch(`https://api.payrexx.com/v1.0/${path}?instance=${encodeURIComponent(instance)}`, {
    method,
    headers: { "X-API-KEY": secret, ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: body ? form(body).toString() : undefined,
  });
  const json: any = await res.json().catch(() => null);
  if (!res.ok || json?.status !== "success" || !json?.data?.[0]) {
    console.error("[payrexx]", path, res.status, json?.message || json);
    throw new Error("Payrexx-Anfrage fehlgeschlagen");
  }
  return json.data[0];
}

export async function createGateway(i: {
  amountChf: number; purpose: string; referenceId: string; successUrl: string; cancelUrl: string;
  email?: string; adresse?: boolean;
}): Promise<{ id: number; link: string }> {
  const amount = Math.round(i.amountChf * 100);
  if (amount < 50) throw new Error("Mindestbetrag CHF 0.50");
  const fields: Record<string, unknown> = {
    email: { mandatory: 1, defaultValue: i.email },
    forename: { mandatory: i.adresse ? 1 : 0 },
    surname: { mandatory: i.adresse ? 1 : 0 },
  };
  if (i.adresse) {
    fields.street = { mandatory: 1 };
    fields.postcode = { mandatory: 1 };
    fields.place = { mandatory: 1 };
    fields.country = { mandatory: 1, defaultValue: "CH" };
    fields.phone = { mandatory: 0 };
  }
  const g = await payrexxCall("POST", "Gateway/", {
    amount, currency: "CHF", purpose: i.purpose.slice(0, 200), referenceId: i.referenceId,
    successRedirectUrl: i.successUrl, failedRedirectUrl: i.cancelUrl, cancelRedirectUrl: i.cancelUrl,
    language: "DE", skipResultPage: 1, fields,
  });
  return { id: Number(g.id), link: String(g.link) };
}

/** Transaktion direkt bei Payrexx abrufen – einzige vertrauenswürdige Quelle für Webhooks. */
export async function getTransaction(id: number) {
  return payrexxCall("GET", `Transaction/${id}/`);
}
