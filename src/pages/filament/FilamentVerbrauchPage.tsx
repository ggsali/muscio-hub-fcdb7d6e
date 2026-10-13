import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  buildLines, sumByFilament, sumByMonth, sumByOrder, toCsv, kg, chf, orderDate,
  type VOrder, type VPart, type VFilament,
} from "@/lib/filamentVerbrauch";

/** Reihenfolge des Workflows – Filament gilt als verbraucht, sobald der Druck gestartet wurde */
const AB_DRUCK = ["Im Druck", "Qualitätsprüfung", "Versandt", "Geliefert", "Abgeschlossen"];
const AB_VERSAND = ["Versandt", "Geliefert", "Abgeschlossen"];
const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

const sel = "h-11 md:h-10 rounded-md border border-border bg-input px-3 text-sm";

async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: any; error: any }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    out.push(...((data || []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export default function FilamentVerbrauchPage() {
  const [jahr, setJahr] = useState(new Date().getFullYear());
  const [monat, setMonat] = useState(0); // 0 = ganzes Jahr
  const [ab, setAb] = useState<"druck" | "versand">("druck");
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<VOrder[]>([]);
  const [parts, setParts] = useState<VPart[]>([]);
  const [filaments, setFilaments] = useState<VFilament[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [o, f] = await Promise.all([
          fetchAll<VOrder>((a, b) =>
            supabase.from("orders").select("id, name, beschreibung, datum, created_at, status").in("status", AB_DRUCK).range(a, b)),
          fetchAll<VFilament>((a, b) =>
            supabase.from("filaments").select("id, name, material, farbe, preis_pro_kg").range(a, b)),
        ]);
        const ids = o.map((x) => x.id);
        const p: VPart[] = [];
        for (let i = 0; i < ids.length; i += 100) {
          const chunk = ids.slice(i, i + 100);
          p.push(...await fetchAll<VPart>((a, b) =>
            supabase.from("parts").select("order_id, teilname, menge, material, gewicht_g, support_gewicht_g, filament_id, support_filament_id, filament_einkauf_pro_kg").in("order_id", chunk).range(a, b)));
        }
        setOrders(o); setFilaments(f); setParts(p);
      } catch (e: any) {
        toast.error("Laden fehlgeschlagen: " + (e?.message || e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const jahre = useMemo(() => {
    const s = new Set<number>([new Date().getFullYear()]);
    orders.forEach((o) => { const y = parseInt(orderDate(o).slice(0, 4), 10); if (y) s.add(y); });
    return [...s].sort((a, b) => b - a);
  }, [orders]);

  const lines = useMemo(() => {
    const status = ab === "druck" ? AB_DRUCK : AB_VERSAND;
    const prefix = monat ? `${jahr}-${String(monat).padStart(2, "0")}` : String(jahr);
    const gewaehlt = orders.filter((o) => status.includes(o.status || "") && orderDate(o).startsWith(prefix));
    return buildLines(gewaehlt, parts, filaments);
  }, [orders, parts, filaments, jahr, monat, ab]);

  const perFilament = useMemo(() => sumByFilament(lines), [lines]);
  const perMonat = useMemo(() => sumByMonth(lines), [lines]);
  const perOrder = useMemo(() => sumByOrder(lines), [lines]);
  const totalG = lines.reduce((s, l) => s + l.gramm, 0);
  const totalK = lines.reduce((s, l) => s + (l.kosten ?? 0), 0);
  const ohnePreis = lines.filter((l) => l.kosten == null).reduce((s, l) => s + l.gramm, 0);
  const nichtZugeordnet = perFilament.filter((f) => f.key.startsWith("mat:")).reduce((s, f) => s + f.gramm, 0);

  const exportCsv = () => {
    const blob = new Blob([toCsv(lines)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `filamentverbrauch_${jahr}${monat ? "-" + String(monat).padStart(2, "0") : ""}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const th = "text-left text-[11px] uppercase tracking-wide text-muted-foreground font-medium px-3 py-2";
  const td = "px-3 py-2.5 text-sm";

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl">
      <div>
        <h1 className="text-xl md:text-2xl font-bold">Filamentverbrauch</h1>
        <p className="text-sm text-muted-foreground">Verbrauchtes Material pro Filament und Auftrag – für Buchhaltung und Steuern.</p>
      </div>

      <div className="grid grid-cols-2 md:flex gap-2 md:items-center">
        <select className={sel} value={jahr} onChange={(e) => setJahr(Number(e.target.value))}>
          {jahre.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select className={sel} value={monat} onChange={(e) => setMonat(Number(e.target.value))}>
          <option value={0}>Ganzes Jahr</option>
          {MONATE.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select className={`${sel} col-span-2 md:col-span-1`} value={ab} onChange={(e) => setAb(e.target.value as any)}>
          <option value="druck">Aufträge ab «Im Druck»</option>
          <option value="versand">Nur ab «Versandt»</option>
        </select>
        <Button onClick={exportCsv} disabled={!lines.length} variant="outline" className="col-span-2 md:col-span-1 md:ml-auto h-11 md:h-10 gap-2">
          <Download className="w-4 h-4" /> CSV-Export
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-10"><Loader2 className="w-4 h-4 animate-spin" /> Lädt…</div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 md:gap-3">
            <div className="bg-card border border-border rounded-lg p-3 md:p-4">
              <p className="text-[11px] text-muted-foreground">Verbrauch</p>
              <p className="text-lg md:text-2xl font-bold">{kg(totalG)} kg</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3 md:p-4">
              <p className="text-[11px] text-muted-foreground">Materialkosten</p>
              <p className="text-lg md:text-2xl font-bold">CHF {chf(totalK)}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3 md:p-4">
              <p className="text-[11px] text-muted-foreground">Aufträge</p>
              <p className="text-lg md:text-2xl font-bold">{perOrder.length}</p>
            </div>
          </div>

          {(ohnePreis > 0 || nichtZugeordnet > 0) && (
            <div className="text-xs bg-warning/10 border border-warning/30 rounded-lg px-3 py-2 flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-warning mt-0.5" />
              <div>
                {nichtZugeordnet > 0 && <p>{kg(nichtZugeordnet)} kg sind keinem Filament zugeordnet (nur Material-Text). Im Auftrag beim Teil das Filament wählen, dann stimmt die Aufteilung.</p>}
                {ohnePreis > 0 && <p>{kg(ohnePreis)} kg haben keinen Einkaufspreis und fehlen in den Materialkosten.</p>}
              </div>
            </div>
          )}

          <section className="bg-card border border-border rounded-lg overflow-hidden">
            <h2 className="font-semibold text-sm px-3 pt-3">Nach Filament</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px]">
                <thead><tr><th className={th}>Filament</th><th className={`${th} text-right`}>Verbrauch</th><th className={`${th} text-right`}>Kosten CHF</th></tr></thead>
                <tbody>
                  {perFilament.map((f) => (
                    <tr key={f.key} className="border-t border-border">
                      <td className={td}>{f.label}</td>
                      <td className={`${td} text-right font-mono`}>{kg(f.gramm)} kg</td>
                      <td className={`${td} text-right font-mono`}>{f.ohnePreisGramm > 0 && f.kosten === 0 ? "—" : chf(f.kosten)}</td>
                    </tr>
                  ))}
                  {!perFilament.length && <tr><td className={`${td} text-muted-foreground`} colSpan={3}>Keine Daten für diesen Zeitraum.</td></tr>}
                  {perFilament.length > 0 && (
                    <tr className="border-t-2 border-border font-semibold">
                      <td className={td}>Total</td><td className={`${td} text-right font-mono`}>{kg(totalG)} kg</td><td className={`${td} text-right font-mono`}>{chf(totalK)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {monat === 0 && perMonat.length > 0 && (
            <section className="bg-card border border-border rounded-lg overflow-hidden">
              <h2 className="font-semibold text-sm px-3 pt-3">Nach Monat</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px]">
                  <thead><tr><th className={th}>Monat</th><th className={`${th} text-right`}>Verbrauch</th><th className={`${th} text-right`}>Kosten CHF</th></tr></thead>
                  <tbody>
                    {perMonat.map((m) => (
                      <tr key={m.monat} className="border-t border-border">
                        <td className={td}>{MONATE[parseInt(m.monat.slice(5, 7), 10) - 1]} {m.monat.slice(0, 4)}</td>
                        <td className={`${td} text-right font-mono`}>{kg(m.gramm)} kg</td>
                        <td className={`${td} text-right font-mono`}>{chf(m.kosten)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="bg-card border border-border rounded-lg overflow-hidden">
            <h2 className="font-semibold text-sm px-3 pt-3">Nach Auftrag</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px]">
                <thead><tr><th className={th}>Datum</th><th className={th}>Auftrag</th><th className={`${th} text-right`}>Verbrauch</th><th className={`${th} text-right`}>Kosten CHF</th></tr></thead>
                <tbody>
                  {perOrder.map((o) => (
                    <tr key={o.orderId} className="border-t border-border">
                      <td className={`${td} whitespace-nowrap`}>{o.datum.split("-").reverse().join(".")}</td>
                      <td className={td}><a className="text-primary hover:underline" href={`/admin/auftraege/${o.orderId}`}>{o.name}</a></td>
                      <td className={`${td} text-right font-mono`}>{kg(o.gramm)} kg</td>
                      <td className={`${td} text-right font-mono`}>{chf(o.kosten)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <p className="text-[11px] text-muted-foreground">
            Berechnung: Gewicht pro Teil × Menge (inkl. Support). Verbraucht ist, was in Aufträgen ab «Im Druck» steht. Fehldrucke, Reste und Spülmaterial sind nicht erfasst. Für die Steuer zählt der Einkauf der Rollen und der Lagerbestand am Jahresende.
          </p>
        </>
      )}
    </div>
  );
}
