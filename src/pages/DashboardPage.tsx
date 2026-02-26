import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/contexts/SettingsContext";
import { formatCHF, formatPct } from "@/lib/calc";
import { StatusBadge } from "@/components/StatusBadge";
import { useNavigate } from "react-router-dom";
import { TrendingUp, DollarSign, PiggyBank, Percent, Clock, Target, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

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

export default function DashboardPage() {
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [kpis, setKpis] = useState<KPIs>({ umsatz: 0, gewinn: 0, offeneAuftraege: 0, avgMarge: 0, investFonds: 0 });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: orders } = await supabase
        .from("orders")
        .select("*, customers(name)")
        .order("created_at", { ascending: false });

      if (orders) {
        const abgeschlossen = orders.filter(o => o.status === "Abgeschlossen");
        const umsatz = abgeschlossen.reduce((s, o) => s + (o.umsatz_total || 0), 0);
        const gewinn = abgeschlossen.reduce((s, o) => s + (o.gewinn_total || 0), 0);
        const offeneAuftraege = orders.filter(o => o.status === "In Bearbeitung").length;
        const marges = abgeschlossen.filter(o => o.marge > 0).map(o => o.marge);
        const avgMarge = marges.length ? marges.reduce((a, b) => a + b, 0) / marges.length : 0;
        const investFonds = gewinn * (settings.investitions_fonds_prozent / 100);

        setKpis({ umsatz, gewinn, offeneAuftraege, avgMarge, investFonds });

        const recent = orders.slice(0, 5).map(o => ({
          id: o.id,
          datum: o.datum,
          beschreibung: o.beschreibung || "—",
          umsatz_total: o.umsatz_total || 0,
          status: o.status,
          customer_name: (o.customers as any)?.name || "Kein Kunde",
        }));
        setRecentOrders(recent);
      }
      setLoading(false);
    }
    load();
  }, [settings]);

  const skalierungsProgress = Math.min((kpis.gewinn / settings.skalierungsziel) * 100, 100);

  const kpiCards = [
    { label: "Gesamtumsatz", value: formatCHF(kpis.umsatz), icon: <DollarSign className="w-5 h-5" />, color: "text-info" },
    { label: "Reingewinn", value: formatCHF(kpis.gewinn), icon: <TrendingUp className="w-5 h-5" />, color: "text-success" },
    { label: "Investitions-Fonds", value: formatCHF(kpis.investFonds), icon: <PiggyBank className="w-5 h-5" />, color: "text-primary" },
    { label: "Ø Marge", value: formatPct(kpis.avgMarge), icon: <Percent className="w-5 h-5" />, color: "text-purple" },
    { label: "Offene Aufträge", value: String(kpis.offeneAuftraege), icon: <Clock className="w-5 h-5" />, color: "text-warning" },
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Übersicht deines Business</p>
        </div>
        <Button
          onClick={() => navigate("/auftraege/neu")}
          className="bg-primary hover:bg-primary/90 gap-2"
        >
          <Plus className="w-4 h-4" />
          Neuer Auftrag
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {kpiCards.map(card => (
          <div key={card.label} className="kpi-card">
            <div className={`${card.color}`}>{card.icon}</div>
            <div className="text-xl font-bold">{card.value}</div>
            <div className="text-xs text-muted-foreground">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Skalierungsziel */}
      <div className="kpi-card">
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-5 h-5 text-success" />
          <span className="font-medium text-sm">Skalierungsziel</span>
          <span className="ml-auto text-sm text-muted-foreground">
            {formatCHF(kpis.gewinn)} / {formatCHF(settings.skalierungsziel)}
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-2.5">
          <div
            className="bg-success h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${skalierungsProgress}%` }}
          />
        </div>
        <div className="text-xs text-muted-foreground mt-1">{skalierungsProgress.toFixed(1)}% erreicht</div>
      </div>

      {/* Recent Orders */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-sm">Letzte Aufträge</h2>
          <button onClick={() => navigate("/auftraege")} className="text-xs text-primary hover:underline">
            Alle anzeigen
          </button>
        </div>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Laden...</div>
        ) : recentOrders.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Noch keine Aufträge</div>
        ) : (
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
                <tr
                  key={order.id}
                  className="table-row-alt border-b border-border/50 last:border-0"
                  onClick={() => navigate(`/auftraege/${order.id}`)}
                >
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
