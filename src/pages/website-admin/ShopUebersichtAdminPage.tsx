import { useEffect, useState } from "react";
import { Link } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import {
  ShoppingBag, Package, TrendingUp, AlertTriangle, Clock, CheckCircle2,
  ArrowRight, Banknote, ShoppingCart, Eye,
} from "lucide-react";

interface ShopOrder {
  id: string;
  customer_name: string;
  customer_email: string;
  total: number;
  status: string;
  created_at: string;
  paid_at: string | null;
}
interface OrderItem {
  product_name: string;
  quantity: number;
  total: number;
  order_id: string;
}
interface ShopProduct {
  id: string;
  name: string;
  slug: string;
  preis: number;
  lagerbestand: number;
  unendlich_bestand: boolean;
  aktiv: boolean;
}

const fmtCHF = (n: number) =>
  new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" }).format(n || 0);

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "2-digit" });

export default function ShopUebersichtAdminPage() {
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const [ordersRes, itemsRes, productsRes] = await Promise.all([
        supabase.from("shop_orders").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("shop_order_items").select("product_name, quantity, total, order_id").gte("created_at", since),
        supabase.from("shop_products").select("id, name, slug, preis, lagerbestand, unendlich_bestand, aktiv"),
      ]);
      setOrders((ordersRes.data as ShopOrder[]) || []);
      setItems((itemsRes.data as OrderItem[]) || []);
      setProducts((productsRes.data as ShopProduct[]) || []);
      setLoading(false);
    })();
  }, []);

  const now = Date.now();
  const isPaid = (o: ShopOrder) => o.status === "paid" || !!o.paid_at;
  const paidOrders = orders.filter(isPaid);

  const within = (ms: number) => paidOrders.filter(o => now - new Date(o.created_at).getTime() <= ms);
  const today = within(86400000);
  const last7 = within(7 * 86400000);
  const last30 = within(30 * 86400000);

  const sum = (arr: ShopOrder[]) => arr.reduce((s, o) => s + Number(o.total || 0), 0);
  const umsatzToday = sum(today);
  const umsatz7 = sum(last7);
  const umsatz30 = sum(last30);
  const aov = last30.length ? umsatz30 / last30.length : 0;

  const offen = orders.filter(o => !isPaid(o)).length;

  // Top-Produkte 30T (Umsatz)
  const productAgg = new Map<string, { umsatz: number; menge: number }>();
  items.forEach(i => {
    const cur = productAgg.get(i.product_name) || { umsatz: 0, menge: 0 };
    cur.umsatz += Number(i.total || 0);
    cur.menge += Number(i.quantity || 0);
    productAgg.set(i.product_name, cur);
  });
  const topProducts = [...productAgg.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.umsatz - a.umsatz)
    .slice(0, 5);

  const lowStock = products
    .filter(p => p.aktiv && !p.unendlich_bestand && p.lagerbestand <= 3)
    .sort((a, b) => a.lagerbestand - b.lagerbestand)
    .slice(0, 6);

  const recentOrders = orders.slice(0, 5);
  const activeProducts = products.filter(p => p.aktiv).length;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      <div>
        <h1 className="font-heading text-xl md:text-2xl font-bold text-foreground">Shop-Übersicht</h1>
        <p className="text-xs md:text-sm text-muted-foreground">Wichtige Kennzahlen und Schnellzugriffe</p>
      </div>

      {/* Schnellzugriff */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/website-admin/bestellungen"
          className="group bg-card border border-border rounded-xl p-4 hover:border-primary transition-colors"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
          <p className="font-semibold text-sm text-foreground">Bestellungen</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {offen > 0 ? `${offen} offen` : "Alle bearbeitet"}
          </p>
        </Link>
        <Link
          to="/website-admin/shop-produkte"
          className="group bg-card border border-border rounded-xl p-4 hover:border-primary transition-colors"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
          <p className="font-semibold text-sm text-foreground">Produkte verwalten</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{activeProducts} aktiv</p>
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={<Banknote className="w-4 h-4" />} label="Umsatz heute" value={fmtCHF(umsatzToday)} sub={`${today.length} Best.`} />
        <Kpi icon={<TrendingUp className="w-4 h-4" />} label="Umsatz 7 Tage" value={fmtCHF(umsatz7)} sub={`${last7.length} Best.`} />
        <Kpi icon={<TrendingUp className="w-4 h-4" />} label="Umsatz 30 Tage" value={fmtCHF(umsatz30)} sub={`${last30.length} Best.`} />
        <Kpi icon={<ShoppingCart className="w-4 h-4" />} label="Ø Bestellwert" value={fmtCHF(aov)} sub="30 Tage" />
      </div>

      {/* Lagerbestand-Warnung */}
      {lowStock.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h2 className="font-semibold text-sm text-foreground">Niedriger Lagerbestand</h2>
          </div>
          <div className="space-y-2">
            {lowStock.map(p => (
              <Link
                key={p.id}
                to="/website-admin/shop-produkte"
                className="flex items-center justify-between gap-3 py-1.5 hover:text-primary transition-colors"
              >
                <span className="text-sm text-foreground truncate">{p.name}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-md flex-shrink-0 ${
                  p.lagerbestand === 0
                    ? "bg-destructive/15 text-destructive"
                    : "bg-amber-500/15 text-amber-500"
                }`}>
                  {p.lagerbestand} Stk
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Top-Produkte 30 Tage */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm text-foreground">Top-Produkte (30 Tage)</h2>
          </div>
        </div>
        {topProducts.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">Keine Verkäufe in den letzten 30 Tagen.</p>
        ) : (
          <div className="space-y-2">
            {topProducts.map((p, idx) => (
              <div key={p.name} className="flex items-center gap-3 py-1.5">
                <span className="w-5 h-5 rounded-md bg-muted text-[10px] font-bold text-foreground flex items-center justify-center flex-shrink-0">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{p.name}</p>
                  <p className="text-[11px] text-muted-foreground">{p.menge}× verkauft</p>
                </div>
                <span className="text-sm font-semibold text-foreground flex-shrink-0">
                  {fmtCHF(p.umsatz)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Letzte Bestellungen */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm text-foreground">Letzte Bestellungen</h2>
          </div>
          <Link to="/website-admin/bestellungen" className="text-xs text-primary hover:underline flex items-center gap-1">
            Alle <Eye className="w-3 h-3" />
          </Link>
        </div>
        {recentOrders.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">Noch keine Bestellungen.</p>
        ) : (
          <div className="space-y-2">
            {recentOrders.map(o => (
              <Link
                key={o.id}
                to="/website-admin/bestellungen"
                className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0 hover:opacity-80 transition-opacity"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{o.customer_name}</p>
                  <p className="text-[11px] text-muted-foreground">{fmtDate(o.created_at)}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-sm font-semibold text-foreground">{fmtCHF(Number(o.total))}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded inline-flex items-center gap-1 ${
                    isPaid(o)
                      ? "bg-emerald-500/15 text-emerald-500"
                      : "bg-amber-500/15 text-amber-500"
                  }`}>
                    {isPaid(o) ? <CheckCircle2 className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
                    {isPaid(o) ? "Bezahlt" : "Offen"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        {icon}
        <span className="text-[10px] uppercase tracking-wide font-semibold">{label}</span>
      </div>
      <p className="font-bold text-base md:text-lg text-foreground leading-tight">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}
