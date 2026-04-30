import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/contexts/SettingsContext";
import { formatCHF, formatPct } from "@/lib/calc";
import { StatusBadge } from "@/components/StatusBadge";
import { useNavigate } from "react-router-dom";
import { TrendingUp, DollarSign, PiggyBank, Percent, Clock, Target, Plus, ChevronRight, ShoppingBag, Mail, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from "recharts";

interface KPIs {
  umsatz: number;
  gewinn: number;
  offeneAuftraege: number;
  avgMarge: number;
  investFonds: number;
}

interface RecentOrder {
  id: string;
  datum: string;
  beschreibung: string;
  umsatz_total: number;
  status: string;
  customer_name: string;
}

interface MonthlyData {
  monat: string;
  umsatz: number;
  gewinn: number;
}

interface TopKunde {
  name: string;
  umsatz: number;
}

const ACCENT = "hsl(var(--primary))";
const SUCCESS = "hsl(var(--success))";

export default function DashboardPage() {
  const { settings } = useSettings();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [kpis, setKpis] = useState<KPIs>({ umsatz: 0, gewinn: 0, offeneAuftraege: 0, avgMarge: 0, investFonds: 0 });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [topKunden, setTopKunden] = useState<TopKunde[]>([]);
  const [websiteOrders, setWebsiteOrders] = useState<any[]>([]);
  const [neueAnfragen, setNeueAnfragen] = useState<any[]>([]);
  const [neueKunden, setNeueKunden] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: orders } = await supabase
        .from("orders")
        .select("*, customers(name, vorname, firma, email)")
        .order("datum", { ascending: false });

      const fullName = (c: any) =>
        c
          ? [c.vorname, c.name].filter(Boolean).join(" ").trim() || c.firma || c.email || "Kunde ohne Name"
          : "Kein Kunde";

      if (orders) {
        const abgeschlossen = orders.filter(o => o.status === "Abgeschlossen");
        const umsatz = abgeschlossen.reduce((s, o) => s + (o.umsatz_total || 0), 0);
        const gewinn = abgeschlossen.reduce((s, o) => s + (o.gewinn_total || 0), 0);
        const offeneAuftraege = orders.filter(o => ["Offen", "In Bearbeitung"].includes(o.status)).length;
        const marges = abgeschlossen.filter(o => o.marge > 0).map(o => o.marge);
        const avgMarge = marges.length ? marges.reduce((a, b) => a + b, 0) / marges.length : 0;
        const investFonds = gewinn * (settings.investitions_fonds_prozent / 100);

        setKpis({ umsatz, gewinn, offeneAuftraege, avgMarge, investFonds });

        const recent = orders.slice(0, 5).map(o => ({
          id: o.id,
          datum: o.datum,
          beschreibung: o.name || o.beschreibung || "Ohne Titel",
          umsatz_total: o.umsatz_total || 0,
          status: o.status,
          customer_name: fullName(o.customers),
        }));
        setRecentOrders(recent);

        const monthMap: Record<string, { umsatz: number; gewinn: number }> = {};
        abgeschlossen.forEach(o => {
          if (!o.datum) return;
          const key = o.datum.substring(0, 7);
          if (!monthMap[key]) monthMap[key] = { umsatz: 0, gewinn: 0 };
          monthMap[key].umsatz += o.umsatz_total || 0;
          monthMap[key].gewinn += o.gewinn_total || 0;
        });
        const months = Object.keys(monthMap).sort().slice(-6).map(k => ({
          monat: new Date(k + "-01").toLocaleDateString("de-CH", { month: "short", year: "2-digit" }),
          umsatz: Math.round(monthMap[k].umsatz * 100) / 100,
          gewinn: Math.round(monthMap[k].gewinn * 100) / 100,
        }));
        setMonthlyData(months);

        const kundeMap: Record<string, number> = {};
        orders.forEach(o => {
          const name = fullName(o.customers);
          if (!kundeMap[name]) kundeMap[name] = 0;
          kundeMap[name] += o.umsatz_total || 0;
        });
        const top = Object.entries(kundeMap)
          .map(([name, umsatz]) => ({ name, umsatz }))
          .sort((a, b) => b.umsatz - a.umsatz)
          .slice(0, 5);
        setTopKunden(top);
      }

      // Webshop-Bestellungen + neue Anfragen + neueste Kunden parallel
      const [{ data: shopO }, { data: anfr }, { data: kun }] = await Promise.all([
        supabase.from("orders").select("id, datum, beschreibung, umsatz_total, status, name, customers(name)").eq("source", "website-shop").order("datum", { ascending: false }).limit(5),
        supabase.from("inquiries").select("id, name, email, betreff, nachricht, status, created_at").eq("status", "Neu").order("created_at", { ascending: false }).limit(5),
        supabase.from("customers").select("id, name, vorname, firma, email, created_at").order("created_at", { ascending: false }).limit(5),
      ]);
      setWebsiteOrders(shopO || []);
      setNeueAnfragen(anfr || []);
      setNeueKunden(kun || []);

      setLoading(false);
    }
    load();
  }, [settings]);

  const skalierungsProgress = Math.min((kpis.gewinn / settings.skalierungsziel) * 100, 100);

  const kpiCards = [
    { label: "Gesamtumsatz", value: formatCHF(kpis.umsatz), icon: <DollarSign className="w-4 h-4 md:w-5 md:h-5" />, color: "text-info" },
    { label: "Reingewinn", value: formatCHF(kpis.gewinn), icon: <TrendingUp className="w-4 h-4 md:w-5 md:h-5" />, color: "text-success" },
    { label: "Invest-Fonds", value: formatCHF(kpis.investFonds), icon: <PiggyBank className="w-4 h-4 md:w-5 md:h-5" />, color: "text-primary" },
    { label: "Ø Marge", value: formatPct(kpis.avgMarge), icon: <Percent className="w-4 h-4 md:w-5 md:h-5" />, color: "text-purple" },
    { label: "Offen", value: String(kpis.offeneAuftraege), icon: <Clock className="w-4 h-4 md:w-5 md:h-5" />, color: "text-warning" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Übersicht deines Business</p>
        </div>
        <Button onClick={() => navigate("/admin/auftraege/neu")} className="bg-primary hover:bg-primary/90 gap-2" size={isMobile ? "sm" : "default"}>
          <Plus className="w-4 h-4" />
          {isMobile ? "Neu" : "Neuer Auftrag"}
        </Button>
      </div>

      {/* KPI Cards – 2 Spalten auf Mobile, 5 auf Desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 md:gap-4">
        {kpiCards.map(card => (
          <div key={card.label} className="kpi-card py-3 px-3 md:py-4 md:px-4">
            <div className={`${card.color}`}>{card.icon}</div>
            <div className="text-lg md:text-xl font-bold leading-tight">{card.value}</div>
            <div className="text-[10px] md:text-xs text-muted-foreground leading-tight">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Skalierungsziel */}
      <div className="kpi-card">
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-4 h-4 md:w-5 md:h-5 text-success" />
          <span className="font-medium text-sm">Skalierungsziel</span>
          <span className="ml-auto text-xs md:text-sm text-muted-foreground">
            {formatCHF(kpis.gewinn)} / {formatCHF(settings.skalierungsziel)}
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-2.5">
          <div className="bg-success h-2.5 rounded-full transition-all duration-500" style={{ width: `${skalierungsProgress}%` }} />
        </div>
        <div className="text-xs text-muted-foreground mt-1">{skalierungsProgress.toFixed(1)}% erreicht</div>
      </div>

      {/* Charts */}
      {!loading && (monthlyData.length > 0 || topKunden.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {monthlyData.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-4 md:p-5">
              <h2 className="font-semibold text-sm mb-3 md:mb-4">Umsatz & Gewinn (6 Monate)</h2>
              <ResponsiveContainer width="100%" height={isMobile ? 160 : 200}>
                <AreaChart data={monthlyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradUmsatz" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={ACCENT} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradGewinn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={SUCCESS} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={SUCCESS} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="monat" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={v => `${v}`} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                    labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                    formatter={(val: number, name: string) => [formatCHF(val), name === "umsatz" ? "Umsatz" : "Gewinn"]}
                  />
                  <Area type="monotone" dataKey="umsatz" stroke={ACCENT} strokeWidth={2} fill="url(#gradUmsatz)" />
                  <Area type="monotone" dataKey="gewinn" stroke={SUCCESS} strokeWidth={2} fill="url(#gradGewinn)" />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5 bg-primary rounded" />Umsatz</span>
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5 bg-success rounded" />Gewinn</span>
              </div>
            </div>
          )}

          {topKunden.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-4 md:p-5">
              <h2 className="font-semibold text-sm mb-3 md:mb-4">Top-Kunden nach Umsatz</h2>
              <ResponsiveContainer width="100%" height={isMobile ? 160 : 200}>
                <BarChart data={topKunden} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={v => `${v}`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={isMobile ? 60 : 80} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                    formatter={(val: number) => [formatCHF(val), "Umsatz"]}
                  />
                  <Bar dataKey="umsatz" radius={[0, 4, 4, 0]}>
                    {topKunden.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? "hsl(var(--primary))" : "hsl(var(--muted))"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Website-Aktivität: Webshop-Bestellungen, Anfragen, neue Kunden */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-primary" />
              Webshop-Bestellungen
              {websiteOrders.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary">{websiteOrders.length}</span>
              )}
            </h2>
            <button onClick={() => navigate("/admin/auftraege")} className="text-xs text-primary hover:underline">Alle</button>
          </div>
          {websiteOrders.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">Noch keine Webshop-Bestellungen</div>
          ) : (
            <div className="divide-y divide-border/50">
              {websiteOrders.map(o => (
                <div key={o.id} onClick={() => navigate(`/admin/auftraege/${o.id}`)} className="px-4 py-2.5 cursor-pointer hover:bg-muted/30 active:bg-muted/40 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium truncate">{(o.customers as any)?.name || o.name || "Webshop"}</span>
                    <span className="text-xs font-bold shrink-0">{formatCHF(o.umsatz_total || 0)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <StatusBadge status={o.status} />
                    <span className="text-[10px] text-muted-foreground">{o.datum}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <Mail className="w-4 h-4 text-warning" />
              Neue Anfragen
              {neueAnfragen.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/15 text-warning">{neueAnfragen.length}</span>
              )}
            </h2>
            <button onClick={() => navigate("/admin/anfragen")} className="text-xs text-primary hover:underline">Alle</button>
          </div>
          {neueAnfragen.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">Keine offenen Anfragen</div>
          ) : (
            <div className="divide-y divide-border/50">
              {neueAnfragen.map(a => (
                <div key={a.id} onClick={() => navigate("/admin/anfragen")} className="px-4 py-2.5 cursor-pointer hover:bg-muted/30 active:bg-muted/40 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium truncate">{a.name}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{new Date(a.created_at).toLocaleDateString("de-CH")}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">{a.betreff || a.nachricht}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-success" />
              Neueste Kunden
            </h2>
            <button onClick={() => navigate("/admin/kunden")} className="text-xs text-primary hover:underline">Alle</button>
          </div>
          {neueKunden.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">Noch keine Kunden</div>
          ) : (
            <div className="divide-y divide-border/50">
              {neueKunden.map(k => (
                <div key={k.id} onClick={() => navigate(`/admin/kunden/${k.id}`)} className="px-4 py-2.5 cursor-pointer hover:bg-muted/30 active:bg-muted/40 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium truncate">{[k.vorname, k.name].filter(Boolean).join(" ") || k.firma || "—"}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{new Date(k.created_at).toLocaleDateString("de-CH")}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">{k.email || k.firma || "—"}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 md:px-5 py-3 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-sm">Letzte Aufträge</h2>
          <button onClick={() => navigate("/admin/auftraege")} className="text-xs text-primary hover:underline">Alle anzeigen</button>
        </div>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Laden...</div>
        ) : recentOrders.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Noch keine Aufträge</div>
        ) : isMobile ? (
          /* Mobile: Card-Liste */
          <div className="divide-y divide-border/50">
            {recentOrders.map(order => (
              <div
                key={order.id}
                className="flex items-center justify-between px-4 py-3 cursor-pointer active:bg-muted/30 transition-colors"
                onClick={() => navigate(`/admin/auftraege/${order.id}`)}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{order.customer_name}</span>
                    <StatusBadge status={order.status} />
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{order.beschreibung}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-sm font-bold">{formatCHF(order.umsatz_total)}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Desktop: Tabelle */
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-2.5 text-muted-foreground font-medium">Kunde</th>
                <th className="text-left px-5 py-2.5 text-muted-foreground font-medium">Beschreibung</th>
                <th className="text-right px-5 py-2.5 text-muted-foreground font-medium">Betrag</th>
                <th className="text-left px-5 py-2.5 text-muted-foreground font-medium">Status</th>
                <th className="text-left px-5 py-2.5 text-muted-foreground font-medium">Datum</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map(order => (
                <tr key={order.id} className="table-row-alt border-b border-border/50 last:border-0 cursor-pointer" onClick={() => navigate(`/admin/auftraege/${order.id}`)}>
                  <td className="px-5 py-3">{order.customer_name}</td>
                  <td className="px-5 py-3 text-muted-foreground">{order.beschreibung}</td>
                  <td className="px-5 py-3 num-right">{formatCHF(order.umsatz_total)}</td>
                  <td className="px-5 py-3"><StatusBadge status={order.status} /></td>
                  <td className="px-5 py-3 text-muted-foreground">{order.datum}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
