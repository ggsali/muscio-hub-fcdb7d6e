import { useEffect, useMemo, useState } from "react";
import { Link } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import {
  ShoppingBag, Star, FolderKanban, MessageCircle, Users2, ArrowRight,
  BarChart3, Eye, Users, TrendingUp,
} from "lucide-react";
import { subDays, startOfDay, format } from "date-fns";
import { de } from "date-fns/locale";

type PageView = {
  path: string;
  session_id: string | null;
  created_at: string;
};

export default function WebsiteAdminDashboardPage() {
  const [stats, setStats] = useState({ orders: 0, reviewsPending: 0, projects: 0, chats: 0, customers: 0 });
  const [views, setViews] = useState<PageView[]>([]);

  useEffect(() => {
    (async () => {
      const [orders, revPending, projects, chats, customers] = await Promise.all([
        supabase.from("shop_orders").select("id", { count: "exact", head: true }),
        supabase.from("reviews").select("id", { count: "exact", head: true }).eq("freigegeben", false),
        supabase.from("projekte").select("id", { count: "exact", head: true }).eq("aktiv", true),
        supabase.from("chat_sessions").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("customers").select("id", { count: "exact", head: true }),
      ]);
      setStats({
        orders: orders.count || 0,
        reviewsPending: revPending.count || 0,
        projects: projects.count || 0,
        chats: chats.count || 0,
        customers: customers.count || 0,
      });
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const since = subDays(new Date(), 7).toISOString();
      const { data } = await supabase
        .from("page_views")
        .select("path,session_id,created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: true })
        .limit(10000);
      setViews((data as PageView[]) || []);
    })();
  }, []);

  const aStats = useMemo(() => {
    const total = views.length;
    const sessions = new Set(views.map(v => v.session_id).filter(Boolean)).size;
    const today = startOfDay(new Date()).getTime();
    const todayCount = views.filter(v => new Date(v.created_at).getTime() >= today).length;
    return { total, sessions, todayCount };
  }, [views]);

  const sparkData = useMemo(() => {
    const buckets: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = startOfDay(subDays(new Date(), i));
      buckets[format(d, "yyyy-MM-dd")] = 0;
    }
    for (const v of views) {
      const key = format(startOfDay(new Date(v.created_at)), "yyyy-MM-dd");
      if (buckets[key] !== undefined) buckets[key] += 1;
    }
    return Object.values(buckets);
  }, [views]);

  const cards = [
    { label: "Shop-Bestellungen", value: stats.orders, icon: ShoppingBag, to: "/website-admin/bestellungen", color: "text-primary" },
    { label: "Reviews zu prüfen", value: stats.reviewsPending, icon: Star, to: "/website-admin/reviews", color: "text-yellow-500" },
    { label: "Aktive Projekte", value: stats.projects, icon: FolderKanban, to: "/website-admin/projekte", color: "text-primary" },
    { label: "Aktive Chats", value: stats.chats, icon: MessageCircle, to: "/website-admin/chat", color: "text-primary" },
    { label: "Kunden gesamt", value: stats.customers, icon: Users2, to: "/website-admin/kunden", color: "text-primary" },
  ];

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="font-heading text-xl md:text-3xl font-bold text-foreground mb-2">Website-Verwaltung</h1>
        <p className="text-muted-foreground">Verwalte hier Shop, Reviews, Portfolio und alle Website-Funktionen. Aufträge, Kunden &amp; Buchhaltung bleiben im Projekt-Manager.</p>
      </div>

      {/* Kompaktes Analytics-Widget */}
      <Link
        to="/website-admin/analyse"
        className="group block bg-card border border-border rounded-xl p-5 hover:border-primary transition-colors"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <h2 className="font-heading text-sm font-bold text-foreground uppercase tracking-wider">Besucher-Übersicht (7 Tage)</h2>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <Eye className="w-3.5 h-3.5" /> Aufrufe
            </div>
            <p className="text-2xl font-bold text-foreground tabular-nums">{aStats.total.toLocaleString("de-CH")}</p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <Users className="w-3.5 h-3.5" /> Besucher
            </div>
            <p className="text-2xl font-bold text-foreground tabular-nums">{aStats.sessions.toLocaleString("de-CH")}</p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <TrendingUp className="w-3.5 h-3.5" /> Heute
            </div>
            <p className="text-2xl font-bold text-foreground tabular-nums">{aStats.todayCount.toLocaleString("de-CH")}</p>
          </div>
        </div>

        {/* Mini Sparkline */}
        {sparkData.length > 1 && (
          <div className="h-10 w-full">
            <Sparkline data={sparkData} />
          </div>
        )}
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(c => (
          <Link key={c.label} to={c.to} className="group bg-card border border-border rounded-xl p-5 hover:border-primary transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center ${c.color}`}>
                <c.icon className="w-5 h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <p className="text-xl md:text-3xl font-heading font-extrabold text-foreground">{c.value}</p>
            <p className="text-sm text-muted-foreground mt-1">{c.label}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  const w = 100;
  const h = 40;
  const pad = 2;
  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - (v / max) * (h - pad * 2);
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        opacity={0.8}
      />
      {data.map((v, i) => {
        const x = pad + (i / (data.length - 1)) * (w - pad * 2);
        const y = h - pad - (v / max) * (h - pad * 2);
        return (
          <circle key={i} cx={x} cy={y} r="1.5" fill="hsl(var(--primary))" opacity={0.6} />
        );
      })}
    </svg>
  );
}
