export interface VOrder { id: string; name: string | null; beschreibung: string | null; datum: string | null; created_at: string | null; status: string | null }
export interface VPart {
  order_id: string | null; teilname: string | null; menge: number | null; material: string | null;
  gewicht_g: number | null; support_gewicht_g: number | null;
  filament_id: string | null; support_filament_id: string | null; filament_einkauf_pro_kg: number | null;
}
export interface VFilament { id: string; name: string; material: string | null; farbe: string | null; preis_pro_kg: number | null }

export interface Line {
  orderId: string; orderName: string; datum: string; teil: string;
  filamentKey: string; filamentLabel: string; art: "Teil" | "Support";
  gramm: number; kosten: number | null;
}
export interface FilamentSum { key: string; label: string; gramm: number; kosten: number; ohnePreisGramm: number }

export const orderDate = (o: VOrder) => (o.datum || o.created_at || "").slice(0, 10);

export function buildLines(orders: VOrder[], parts: VPart[], filaments: VFilament[]): Line[] {
  const fById = new Map(filaments.map((f) => [f.id, f]));
  const oById = new Map(orders.map((o) => [o.id, o]));
  const lines: Line[] = [];
  const labelOf = (id: string | null, fallbackMaterial: string | null) => {
    const f = id ? fById.get(id) : undefined;
    if (f) {
      const extra = [f.material, f.farbe].filter(Boolean).join(" ");
      return { key: f.id, label: extra && !f.name.includes(extra) ? `${f.name} (${extra})` : f.name, preis: f.preis_pro_kg };
    }
    const m = (fallbackMaterial || "").trim();
    return { key: `mat:${m || "?"}`, label: m ? `${m} (kein Filament zugeordnet)` : "Nicht zugeordnet", preis: null as number | null };
  };
  for (const p of parts) {
    const o = p.order_id ? oById.get(p.order_id) : undefined;
    if (!o) continue;
    const menge = Number(p.menge) || 0;
    const base = { orderId: o.id, orderName: o.name || o.beschreibung || o.id.slice(0, 8).toUpperCase(), datum: orderDate(o), teil: p.teilname || "" };
    const main = labelOf(p.filament_id, p.material);
    const g = (Number(p.gewicht_g) || 0) * menge;
    if (g > 0) {
      const preis = p.filament_einkauf_pro_kg ?? main.preis;
      lines.push({ ...base, filamentKey: main.key, filamentLabel: main.label, art: "Teil", gramm: g, kosten: preis != null ? (g / 1000) * Number(preis) : null });
    }
    const sg = (Number(p.support_gewicht_g) || 0) * menge;
    if (sg > 0) {
      const sup = p.support_filament_id ? labelOf(p.support_filament_id, null) : main;
      const preis = p.support_filament_id ? sup.preis : (p.filament_einkauf_pro_kg ?? sup.preis);
      lines.push({ ...base, filamentKey: sup.key, filamentLabel: sup.label, art: "Support", gramm: sg, kosten: preis != null ? (sg / 1000) * Number(preis) : null });
    }
  }
  return lines;
}

export function sumByFilament(lines: Line[]): FilamentSum[] {
  const m = new Map<string, FilamentSum>();
  for (const l of lines) {
    const s = m.get(l.filamentKey) || { key: l.filamentKey, label: l.filamentLabel, gramm: 0, kosten: 0, ohnePreisGramm: 0 };
    s.gramm += l.gramm;
    if (l.kosten == null) s.ohnePreisGramm += l.gramm; else s.kosten += l.kosten;
    m.set(l.filamentKey, s);
  }
  return [...m.values()].sort((a, b) => b.gramm - a.gramm);
}

export function sumByMonth(lines: Line[]): { monat: string; gramm: number; kosten: number }[] {
  const m = new Map<string, { monat: string; gramm: number; kosten: number }>();
  for (const l of lines) {
    const k = l.datum.slice(0, 7);
    const s = m.get(k) || { monat: k, gramm: 0, kosten: 0 };
    s.gramm += l.gramm; s.kosten += l.kosten ?? 0;
    m.set(k, s);
  }
  return [...m.values()].sort((a, b) => a.monat.localeCompare(b.monat));
}

export function sumByOrder(lines: Line[]) {
  const m = new Map<string, { orderId: string; name: string; datum: string; gramm: number; kosten: number }>();
  for (const l of lines) {
    const s = m.get(l.orderId) || { orderId: l.orderId, name: l.orderName, datum: l.datum, gramm: 0, kosten: 0 };
    s.gramm += l.gramm; s.kosten += l.kosten ?? 0;
    m.set(l.orderId, s);
  }
  return [...m.values()].sort((a, b) => b.datum.localeCompare(a.datum));
}

export const kg = (g: number) => (g / 1000).toLocaleString("de-CH", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
export const chf = (n: number) => n.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** CSV für Excel (Semikolon, Dezimalkomma, UTF-8 mit BOM) */
export function toCsv(lines: Line[]): string {
  const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const num = (n: number | null, d: number) => (n == null ? "" : n.toFixed(d).replace(".", ","));
  const head = ["Datum", "Auftrag", "Teil", "Art", "Filament", "Gewicht (g)", "Gewicht (kg)", "Materialkosten (CHF)"];
  const rows = [...lines].sort((a, b) => a.datum.localeCompare(b.datum)).map((l) =>
    [l.datum, q(l.orderName), q(l.teil), l.art, q(l.filamentLabel), num(l.gramm, 1), num(l.gramm / 1000, 3), num(l.kosten, 2)].join(";"));
  return "﻿" + [head.join(";"), ...rows].join("\r\n");
}
