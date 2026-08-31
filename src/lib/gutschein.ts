import { supabase } from "@/integrations/supabase/client";

export type GutscheinTyp = "prozent" | "betrag" | "gratis_versand";

export interface Gutschein {
  id: string;
  code: string;
  typ: GutscheinTyp;
  wert: number;
  mindestbestellwert: number | null;
  max_verwendungen: number | null;
  verwendungen: number | null;
  gueltig_ab: string | null;
  gueltig_bis: string | null;
  aktiv: boolean | null;
  kunde_id?: string | null;
  grund?: string | null;
  notiz?: string | null;
  erstellt_am?: string | null;
}

export const TYP_LABELS: Record<GutscheinTyp, string> = {
  prozent: "Prozent-Rabatt",
  betrag: "Betrag (CHF)",
  gratis_versand: "Gratis Versand",
};

/** Zufälligen, gut lesbaren Code erzeugen (ohne verwechselbare Zeichen). */
export function generateGutscheinCode(prefix = "MUSCIO"): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}-${s}`;
}

export function gutscheinWertLabel(g: Pick<Gutschein, "typ" | "wert">): string {
  if (g.typ === "prozent") return `${Number(g.wert)}%`;
  if (g.typ === "betrag") return `CHF ${Number(g.wert).toFixed(2)}`;
  return "Gratis Versand";
}

/** Rabatt auf Zwischensumme + Versand berechnen. */
export function berechneRabatt(
  g: Pick<Gutschein, "typ" | "wert">,
  subtotal: number,
  shipping = 0,
): { rabatt: number; versandGratis: boolean } {
  if (g.typ === "gratis_versand") return { rabatt: shipping, versandGratis: true };
  if (g.typ === "prozent") {
    return { rabatt: Math.round(subtotal * (Number(g.wert) / 100) * 100) / 100, versandGratis: false };
  }
  return { rabatt: Math.min(Number(g.wert), subtotal), versandGratis: false };
}

/** Gutschein-Code gegen die Datenbank prüfen. */
export async function pruefeGutschein(
  code: string,
  subtotal: number,
): Promise<{ ok: true; gutschein: Gutschein } | { ok: false; error: string }> {
  const clean = code.trim().toUpperCase();
  if (!clean) return { ok: false, error: "Bitte Code eingeben." };

  const { data, error } = await supabase
    .from("gutscheine")
    .select("*")
    .eq("code", clean)
    .maybeSingle();

  if (error) return { ok: false, error: "Code konnte nicht geprüft werden." };
  if (!data) return { ok: false, error: "Dieser Code existiert nicht." };

  const g = data as unknown as Gutschein;
  if (!g.aktiv) return { ok: false, error: "Dieser Code ist nicht mehr aktiv." };

  const heute = new Date().toISOString().slice(0, 10);
  if (g.gueltig_ab && heute < g.gueltig_ab) return { ok: false, error: "Dieser Code ist noch nicht gültig." };
  if (g.gueltig_bis && heute > g.gueltig_bis) return { ok: false, error: "Dieser Code ist abgelaufen." };
  if (g.max_verwendungen !== null && (g.verwendungen ?? 0) >= (g.max_verwendungen ?? 0)) {
    return { ok: false, error: "Dieser Code wurde bereits vollständig eingelöst." };
  }
  if ((g.mindestbestellwert ?? 0) > subtotal) {
    return { ok: false, error: `Mindestbestellwert CHF ${Number(g.mindestbestellwert).toFixed(2)} nicht erreicht.` };
  }
  return { ok: true, gutschein: g };
}

/** Einlösung protokollieren und Zähler erhöhen. */
export async function erfasseGutscheinVerwendung(params: {
  gutschein: Gutschein;
  rabattBetrag: number;
  customerId?: string | null;
  orderId?: string | null;
  shopOrderId?: string | null;
}): Promise<void> {
  const { gutschein, rabattBetrag, customerId, orderId, shopOrderId } = params;
  await supabase.from("gutschein_verwendungen").insert({
    gutschein_id: gutschein.id,
    customer_id: customerId ?? null,
    order_id: orderId ?? null,
    shop_order_id: shopOrderId ?? null,
    rabatt_betrag: rabattBetrag,
  } as never);
  await supabase
    .from("gutscheine")
    .update({ verwendungen: (gutschein.verwendungen ?? 0) + 1 } as never)
    .eq("id", gutschein.id);
}
