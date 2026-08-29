import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import {
  Plus, FileText, CheckCircle2, Clock, TrendingUp, TrendingDown, Wallet,
  Download, Trash2, Paperclip,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

type Bill = {
  id: string;
  titel: string;
  betrag: number;
  bezahlt: boolean;
  bezahlt_am: string | null;
  faellig_am: string | null;
  created_at: string;
  order_id: string | null;
  rechnungsnummer: string | null;
  rechnungs_datum: string | null;
  empfaenger_name: string | null;
  file_path: string | null;
  filename: string | null;
};

type Order = {
  id: string;
  name: string | null;
  beschreibung: string | null;
  datum: string | null;
  created_at: string;
  status: string | null;
  umsatz_total: number | null;
  kosten_total: number | null;
  gewinn_total: number | null;
  customer_id: string | null;
};

type Customer = { id: string; name: string | null; vorname: string | null; firma: string | null };

type Ausgabe = {
  id: string;
  datum: string;
  kategorie: string;
  beschreibung: string;
  betrag: number;
  beleg_url: string | null;
  created_at: string;
};

const KATEGORIEN = ["Filament", "Versandmaterial", "Software/Abos", "Maschinen", "Sonstiges"];
const PAID_STATUS = ["Bezahlt", "Abgeschlossen"];

function fmtCHF(n: number) {
  return new Intl.NumberFormat("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
}
function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("de-CH", { month: "short", year: "2-digit" });
}

type RangeKey = "month" | "lastMonth" | "year" | "custom";

function rangeBounds(key: RangeKey, from: string, to: string): { start: Date; end: Date } {
  const now = new Date();
  if (key === "month") return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
  if (key === "lastMonth") return { start: new Date(now.getFullYear(), now.getMonth() - 1, 1), end: new Date(now.getFullYear(), now.getMonth(), 1) };
  if (key === "year") return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear() + 1, 0, 1) };
  const s = from ? new Date(from) : new Date(now.getFullYear(), 0, 1);
  const e = to ? new Date(new Date(to).getTime() + 86400000) : new Date(now.getFullYear() + 1, 0, 1);
  return { start: s, end: e };
}

export default function FinanzenPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [ausgaben, setAusgaben] = useState<Ausgabe[]>([]);
  const [loading, setLoading] = useState(true);

  const [range, setRange] = useState<RangeKey>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    datum: new Date().toISOString().slice(0, 10),
    kategorie: "Filament",
    beschreibung: "",
    betrag: "",
  });
  const [belegFile, setBelegFile] = useState<File | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [b, o, c, a] = await Promise.all([
      (supabase.from as any)("bills")
        .select("id, titel, betrag, bezahlt, bezahlt_am, faellig_am, created_at, order_id, rechnungsnummer, rechnungs_datum, empfaenger_name, file_path, filename")
        .order("created_at", { ascending: false }),
      (supabase.from as any)("orders")
        .select("id, name, beschreibung, datum, created_at, status, umsatz_total, kosten_total, gewinn_total, customer_id")
        .order("created_at", { ascending: false }),
      (supabase.from as any)("customers").select("id, name, vorname, firma"),
      (supabase.from as any)("ausgaben").select("*").order("datum", { ascending: false }),
    ]);
    setBills((b.data as Bill[]) || []);
    setOrders((o.data as Order[]) || []);
    setCustomers((c.data as Customer[]) || []);
    setAusgaben((a.data as Ausgabe[]) || []);
    setLoading(false);
  }

  const custName = (id: string | null) => {
    if (!id) return "—";
    const c = customers.find(x => x.id === id);
    if (!c) return "—";
    return c.firma || [c.vorname, c.name].filter(Boolean).join(" ") || "—";
  };

  const orderDate = (o: Order) => new Date(o.datum || o.created_at);

  const { start, end } = useMemo(() => rangeBounds(range, customFrom, customTo), [range, customFrom, customTo]);

  const ordersInRange = useMemo(
    () => orders.filter(o => { const d = orderDate(o); return d >= start && d < end; }),
    [orders, start, end]
  );

  const einnahmen = useMemo(
    () => ordersInRange.filter(o => PAID_STATUS.includes(o.status || "")).reduce((s, o) => s + Number(o.umsatz_total || 0), 0),
    [ordersInRange]
  );

  const ausgabenInRange = useMemo(
    () => ausgaben.filter(a => { const d = new Date(a.datum); return d >= start && d < end; }),
    [ausgaben, start, end]
  );
  const ausgabenSumme = ausgabenInRange.reduce((s, a) => s + Number(a.betrag || 0), 0);
  const reingewinn = einnahmen - ausgabenSumme;

  const offeneBills = bills.filter(b => !b.bezahlt);
  const offenBetrag = offeneBills.reduce((s, b) => s + Number(b.betrag || 0), 0);
  const bezahltBetrag = bills.filter(b => b.bezahlt).reduce((s, b) => s + Number(b.betrag || 0), 0);

  // 12-Monats-Chart
  const chartData = useMemo(() => {
    const keys: string[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) keys.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
    const inc: Record<string, number> = {};
    const exp: Record<string, number> = {};
    keys.forEach(k => { inc[k] = 0; exp[k] = 0; });
    orders.filter(o => PAID_STATUS.includes(o.status || "")).forEach(o => {
      const k = monthKey(orderDate(o));
      if (k in inc) inc[k] += Number(o.umsatz_total || 0);
    });
    ausgaben.forEach(a => {
      const k = monthKey(new Date(a.datum));
      if (k in exp) exp[k] += Number(a.betrag || 0);
    });
    return keys.map(k => ({
      monat: monthLabel(k),
      key: k,
      einnahmen: Number(inc[k].toFixed(2)),
      ausgaben: Number(exp[k].toFixed(2)),
      gewinn: Number((inc[k] - exp[k]).toFixed(2)),
    }));
  }, [orders, ausgaben]);

  // Marge-Analyse
  const analyse = useMemo(() => {
    const rel = orders.filter(o => Number(o.umsatz_total || 0) > 0);
    const margen = rel.map(o => {
      const u = Number(o.umsatz_total || 0);
      const k = Number(o.kosten_total || 0);
      return ((u - k) / u) * 100;
    });
    const avgMarge = margen.length ? margen.reduce((s, m) => s + m, 0) / margen.length : 0;
    const avgWert = rel.length ? rel.reduce((s, o) => s + Number(o.umsatz_total || 0), 0) / rel.length : 0;
    const withRev = chartData.filter(d => d.einnahmen > 0);
    const best = withRev.length ? withRev.reduce((a, b) => (b.einnahmen > a.einnahmen ? b : a)) : null;
    const worst = withRev.length ? withRev.reduce((a, b) => (b.einnahmen < a.einnahmen ? b : a)) : null;
    return { avgMarge, avgWert, best, worst, count: rel.length };
  }, [orders, chartData]);

  async function download(b: Bill) {
    if (!b.file_path) return;
    const { data } = await supabase.storage.from("bills").createSignedUrl(b.file_path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  async function openBeleg(path: string) {
    const { data } = await supabase.storage.from("bills").createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast.error("Beleg konnte nicht geöffnet werden");
  }

  async function saveAusgabe() {
    const betrag = parseFloat(form.betrag.replace(",", "."));
    if (!form.beschreibung.trim() || Number.isNaN(betrag)) {
      toast.error("Bitte Beschreibung und Betrag angeben");
      return;
    }
    setSaving(true);
    let beleg_url: string | null = null;
    if (belegFile) {
      const path = `ausgaben/${Date.now()}-${belegFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage.from("bills").upload(path, belegFile);
      if (error) toast.error("Beleg-Upload fehlgeschlagen: " + error.message);
      else beleg_url = path;
    }
    const { error } = await (supabase.from as any)("ausgaben").insert({
      datum: form.datum,
      kategorie: form.kategorie,
      beschreibung: form.beschreibung.trim(),
      betrag,
      beleg_url,
    });
    setSaving(false);
    if (error) { toast.error("Speichern fehlgeschlagen: " + error.message); return; }
    toast.success("Ausgabe erfasst");
    setDialogOpen(false);
    setForm({ datum: new Date().toISOString().slice(0, 10), kategorie: "Filament", beschreibung: "", betrag: "" });
    setBelegFile(null);
    load();
  }

  async function deleteAusgabe(id: string) {
    const { error } = await (supabase.from as any)("ausgaben").delete().eq("id", id);
    if (error) { toast.error("Löschen fehlgeschlagen"); return; }
    setAusgaben(prev => prev.filter(a => a.id !== id));
  }

  function exportCsv() {
    const rows = [
      ["Datum", "Auftrag", "Kunde", "Umsatz", "Kosten", "Gewinn", "Status", "Bezahlt"],
      ...ordersInRange.map(o => {
        const u = Number(o.umsatz_total || 0);
        const k = Number(o.kosten_total || 0);
        const paid = bills.some(b => b.order_id === o.id && b.bezahlt) || PAID_STATUS.includes(o.status || "");
        return [
          orderDate(o).toLocaleDateString("de-CH"),
          o.name || o.beschreibung || o.id.slice(0, 8),
          custName(o.customer_id),
          u.toFixed(2), k.toFixed(2), (u - k).toFixed(2),
          o.status || "", paid ? "ja" : "nein",
        ];
      }),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `finanzen-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const sumUmsatz = ordersInRange.reduce((s, o) => s + Number(o.umsatz_total || 0), 0);
  const sumKosten = ordersInRange.reduce((s, o) => s + Number(o.kosten_total || 0), 0);

  const ausgabenProMonat = useMemo(() => {
    const map: Record<string, number> = {};
    ausgaben.forEach(a => {
      const k = monthKey(new Date(a.datum));
      map[k] = (map[k] || 0) + Number(a.betrag || 0);
    });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [ausgaben]);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Finanzen</h1>
          <p className="text-sm text-muted-foreground">Einnahmen, Ausgaben, Gewinn und Rechnungen im Überblick</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Ausgabe
          </Button>
          <Link to="/admin/finanzen/abrechnungen">
            <Button variant="outline">Abrechnungen</Button>
          </Link>
          <Link to="/admin/finanzen/neue-rechnung">
            <Button><Plus className="w-4 h-4 mr-2" /> Rechnung</Button>
          </Link>
        </div>
      </div>

      {/* KPI-Kacheln */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <TrendingUp className="w-4 h-4" />
            <p className="text-xs uppercase tracking-wide">Einnahmen</p>
          </div>
          <p className="text-2xl font-bold mt-2 text-emerald-500">CHF {fmtCHF(einnahmen)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <TrendingDown className="w-4 h-4" />
            <p className="text-xs uppercase tracking-wide">Ausgaben</p>
          </div>
          <p className="text-2xl font-bold mt-2 text-destructive">CHF {fmtCHF(ausgabenSumme)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Wallet className="w-4 h-4" />
            <p className="text-xs uppercase tracking-wide">Reingewinn</p>
          </div>
          <p className={`text-2xl font-bold mt-2 ${reingewinn >= 0 ? "text-emerald-500" : "text-destructive"}`}>
            CHF {fmtCHF(reingewinn)}
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <p className="text-xs uppercase tracking-wide">Offene Rechnungen</p>
          </div>
          <p className="text-2xl font-bold mt-2 text-amber-500">
            {offeneBills.length} · CHF {fmtCHF(offenBetrag)}
          </p>
        </div>
      </div>

      {/* Zeitraum-Filter */}
      <div className="flex items-end gap-2 flex-wrap">
        <div className="w-[190px]">
          <Label className="text-xs text-muted-foreground">Zeitraum</Label>
          <Select value={range} onValueChange={v => setRange(v as RangeKey)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Dieser Monat</SelectItem>
              <SelectItem value="lastMonth">Letzter Monat</SelectItem>
              <SelectItem value="year">Dieses Jahr</SelectItem>
              <SelectItem value="custom">Benutzerdefiniert</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {range === "custom" && (
          <>
            <div>
              <Label className="text-xs text-muted-foreground">Von</Label>
              <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Bis</Label>
              <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} />
            </div>
          </>
        )}
      </div>

      <Tabs defaultValue="uebersicht">
        <TabsList>
          <TabsTrigger value="uebersicht">Übersicht</TabsTrigger>
          <TabsTrigger value="auftraege">Aufträge</TabsTrigger>
          <TabsTrigger value="ausgaben">Ausgaben</TabsTrigger>
        </TabsList>


        {/* ÜBERSICHT */}
        <TabsContent value="uebersicht" className="space-y-6 mt-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <h2 className="font-semibold text-sm mb-4">Umsatzentwicklung (letzte 12 Monate)</h2>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="monat" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: any) => `CHF ${fmtCHF(Number(v))}`}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="einnahmen" name="Einnahmen" stroke="#10b981" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="ausgaben" name="Ausgaben" stroke="#ef4444" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="gewinn" name="Gewinn" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Marge-Analyse */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Ø Marge</p>
              <p className="text-xl font-bold mt-1">{avgMarge.toFixed(1)}%</p>
              <p className="text-[11px] text-muted-foreground mt-1">im Zeitraum</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Aufträge</p>
              <p className="text-xl font-bold mt-1">{ordersInRange.length}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Bester Monat</p>
              <p className="text-xl font-bold mt-1 text-emerald-500">
                {analyse.best ? `CHF ${fmtCHF(analyse.best.einnahmen)}` : "—"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">{analyse.best?.monat || "—"}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Ø Auftragswert</p>
              <p className="text-xl font-bold mt-1">CHF {fmtCHF(einnahmen / Math.max(ordersInRange.length, 1))}</p>
            </div>
          </div>
        </TabsContent>

        {/* AUFTRÄGE */}
        <TabsContent value="auftraege" className="space-y-4 mt-4">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
              <h2 className="font-semibold text-sm">Aufträge im Zeitraum ({ordersInRange.length})</h2>
              <Button size="sm" variant="outline" onClick={exportCsv}>
                <Download className="w-4 h-4 mr-1" /> Als CSV exportieren
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2">Datum</th>
                    <th className="text-left px-4 py-2">Auftrag</th>
                    <th className="text-left px-4 py-2">Kunde</th>
                    <th className="text-right px-4 py-2">Umsatz</th>
                    <th className="text-right px-4 py-2">Kosten</th>
                    <th className="text-right px-4 py-2">Gewinn</th>
                    <th className="text-right px-4 py-2">Marge %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr><td colSpan={7} className="px-4 py-6 text-muted-foreground">Laden…</td></tr>
                  ) : ordersInRange.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Keine Aufträge im Zeitraum.</td></tr>
                  ) : ordersInRange.map(o => {
                    const u = Number(o.umsatz_total || 0);
                    const k = Number(o.kosten_total || 0);
                    const gewinn = u - k;
                    const marge = u ? (gewinn / u) * 100 : 0;
                    return (
                      <tr key={o.id} className="hover:bg-muted/30">
                        <td className="px-4 py-2 whitespace-nowrap">{orderDate(o).toLocaleDateString("de-CH")}</td>
                        <td className="px-4 py-2">
                          <Link to={`/admin/auftraege/${o.id}`} className="hover:text-primary">
                            {o.name || o.beschreibung || o.id.slice(0, 8)}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">{custName(o.customer_id)}</td>
                        <td className="px-4 py-2 text-right">CHF {fmtCHF(u)}</td>
                        <td className="px-4 py-2 text-right text-destructive">CHF {fmtCHF(k)}</td>
                        <td className={`px-4 py-2 text-right ${gewinn >= 0 ? "text-emerald-500" : "text-destructive"}`}>CHF {fmtCHF(gewinn)}</td>
                        <td className="px-4 py-2 text-right text-muted-foreground">{marge.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
                {ordersInRange.length > 0 && (
                  <tfoot className="bg-muted/40 font-semibold">
                    <tr>
                      <td className="px-4 py-2" colSpan={3}>Total</td>
                      <td className="px-4 py-2 text-right">CHF {fmtCHF(sumUmsatz)}</td>
                      <td className="px-4 py-2 text-right text-destructive">CHF {fmtCHF(sumKosten)}</td>
                      <td className={`px-4 py-2 text-right ${sumUmsatz - sumKosten >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                        CHF {fmtCHF(sumUmsatz - sumKosten)}
                      </td>
                      <td className="px-4 py-2 text-right">{avgMarge.toFixed(1)}%</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </TabsContent>


        {/* AUSGABEN */}
        <TabsContent value="ausgaben" className="space-y-4 mt-4">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
              <h2 className="font-semibold text-sm">
                Ausgaben im Zeitraum · CHF {fmtCHF(ausgabenSumme)}
              </h2>
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-1" /> Ausgabe hinzufügen
              </Button>
            </div>
            {ausgabenInRange.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Keine Ausgaben im Zeitraum.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-2">Datum</th>
                      <th className="text-left px-4 py-2">Kategorie</th>
                      <th className="text-left px-4 py-2">Beschreibung</th>
                      <th className="text-right px-4 py-2">Betrag</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {ausgabenInRange.map(a => (
                      <tr key={a.id} className="hover:bg-muted/30">
                        <td className="px-4 py-2 whitespace-nowrap">{new Date(a.datum).toLocaleDateString("de-CH")}</td>
                        <td className="px-4 py-2"><Badge variant="secondary" className="text-[10px]">{a.kategorie}</Badge></td>
                        <td className="px-4 py-2">{a.beschreibung}</td>
                        <td className="px-4 py-2 text-right text-destructive">CHF {fmtCHF(Number(a.betrag))}</td>
                        <td className="px-4 py-2 text-right whitespace-nowrap">
                          {a.beleg_url && (
                            <Button size="sm" variant="ghost" onClick={() => openBeleg(a.beleg_url!)}>
                              <Paperclip className="w-4 h-4" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => deleteAusgabe(a.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="font-semibold text-sm">Ausgaben pro Monat</h2>
            </div>
            {ausgabenProMonat.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">Noch keine Ausgaben erfasst.</div>
            ) : (
              <div className="divide-y divide-border">
                {ausgabenProMonat.map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between px-4 py-2 text-sm">
                    <span>{monthLabel(k)}</span>
                    <span className="font-semibold text-destructive">CHF {fmtCHF(v)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

      </Tabs>

      {/* Ausgabe-Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Ausgabe hinzufügen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Datum</Label>
              <Input type="date" value={form.datum} onChange={e => setForm({ ...form, datum: e.target.value })} />
            </div>
            <div>
              <Label>Kategorie</Label>
              <Select value={form.kategorie} onValueChange={v => setForm({ ...form, kategorie: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KATEGORIEN.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Beschreibung</Label>
              <Textarea rows={2} value={form.beschreibung} onChange={e => setForm({ ...form, beschreibung: e.target.value })} />
            </div>
            <div>
              <Label>Betrag (CHF)</Label>
              <Input inputMode="decimal" value={form.betrag} onChange={e => setForm({ ...form, betrag: e.target.value })} placeholder="0.00" />
            </div>
            <div>
              <Label>Beleg (optional)</Label>
              <Input type="file" accept="image/*,application/pdf" onChange={e => setBelegFile(e.target.files?.[0] || null)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={saveAusgabe} disabled={saving}>{saving ? "Speichern…" : "Speichern"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
