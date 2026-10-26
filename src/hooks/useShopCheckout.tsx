import { useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createShopCheckout } from "@/lib/payrexx.functions";

interface CheckoutOptions {
  items: Array<{ product_id: string; name: string; preis: number; quantity: number; slug: string; optionen?: Array<{ optionId: string; optionName: string; wertId: string; wertName: string }> }>;
  customer?: { email: string; name?: string };
  gutscheinCode?: string;
  onError?: (message: string) => void;
}

/** Startet die Payrexx-Zahlung für den Warenkorb und leitet zur Zahlungsseite weiter. */
export function useShopCheckout() {
  const start = useServerFn(createShopCheckout);
  const [busy, setBusy] = useState(false);
  const openCheckout = useCallback(async (opts: CheckoutOptions) => {
    setBusy(true);
    try {
      const res = await start({ data: {
        items: opts.items.map((i) => ({ product_id: i.product_id, name: i.name, quantity: i.quantity, optionen: (i.optionen || []).map((o) => ({ wertId: o.wertId })) })),
        customer: opts.customer ? { email: opts.customer.email, name: opts.customer.name } : undefined,
        gutscheinCode: opts.gutscheinCode || undefined,
        origin: window.location.origin,
      } });
      if (res.url) { window.location.href = res.url; return; }
      opts.onError?.(res.error || "Bezahlung konnte nicht gestartet werden");
    } catch (e) {
      opts.onError?.(e instanceof Error ? e.message : "Bezahlung konnte nicht gestartet werden");
    }
    setBusy(false);
  }, [start]);
  return { openCheckout, busy };
}
