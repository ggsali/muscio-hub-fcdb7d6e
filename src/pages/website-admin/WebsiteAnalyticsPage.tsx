import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart3, Eye, Users, Globe, Smartphone, Monitor, Tablet, TrendingUp, RefreshCw, MapPin,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { format, subDays, startOfDay } from "date-fns";
import { de } from "date-fns/locale";

type PageView = {
  id: string;
  path: string;
  referrer: string | null;
  user_agent: string | null;
  device: string | null;
  session_id: string | null;
  created_at: string;
};

const RANGES = [
  { key: "7", label: "7 Tage", days: 7 },
  { key: "30", label: "30 Tage", days: 30 },
  { key: "90", label: "90 Tage", days: 90 },
];

function shortReferrer(r: string | null): string {
  if (!r) return "Direkt";
  try {
    const u = new URL(r);
    if (u.hostname.includes("3dmuscio")) return "Direkt";
    return u.hostname.replace(/^www\./, "");
  } catch {
    return r;
  }
}

export default function WebsiteAnalyticsPage() {
  const [rangeKey, setRangeKey] = useState("30");
  const [views, setViews] = useState<PageView[]>([]);
  const [loading, setLoading] = useState(true);
  const [herkunft, setHerkunft] = useState<[string, number][]>([]);

  const range = RANGES.find(r => r.key === rangeKey)!;

  async function load() {
    setLoading(true);
    const since = subDays(new Date(), range.days).toISOString();
    const { data } = await supabase
      .from("page_views")
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10000);
    setViews((data as PageView[]) || []);
    setLoading(false);
  }

  async function loadHerkunft() {
    const since90 = subDays(new Date(), 90).toISOString();
    const { data } = await supabase
      .from("inquiries")
      .select("herkunft")
      .not("herkunft", "is", null)
      .gte("created_at", since90);
    const counts: Record<string, number> = {};
    ((data as { herkunft: string | null }[]) || []).forEach(r => {
      if (r.herkunft) counts[r.herkunft] = (counts[r.herkunft] || 0) + 1;
    });
    setHerkunft(Object.entries(counts).sort((a, b) => b[1] - a[1]));
  }

  async function loadCalcEvents() {
    const since30 = subDays(new Date(), 30).toISOString();
    const { data } = await supabase
      .from("calc_events")
      .select("event")
      .gte("created_at", since30)
      .limit(20000);
    const counts: Record<string, number> = {};
    ((data as { event: string }[]) || []).forEach(r => {
      counts[r.event] = (counts[r.event] || 0) + 1;
    });
    setCalcCounts(counts);
  }

  useEffect(() => { loadHerkunft(); loadCalcEvents(); }, []);

  const herkunftTotal = herkunft.reduce((s, [, n]) => s + n, 0);

  const funnel = useMemo(() => {
    const c = calcCounts;
    const materialGewaehlt =
      (c["schritt_2_ki_empfehlung_uebernommen"] || 0) + (c["schritt_2_material_manuell_gewaehlt"] || 0);
    const steps = [
      { label: "Datei hochgeladen", count: c["schritt_1_datei_hochgeladen"] || 0 },
      { label: "KI-Chat gestartet", count: c["schritt_2_ki_chat_gestartet"] || 0 },
      { label: "Material gewählt", count: materialGewaehlt },
      { label: "Farbe gewählt", count: c["schritt_3_farbe_gewaehlt"] || 0 },
      { label: "Qualität gewählt", count: c["schritt_4_qualitaet_gewaehlt"] || 0 },
      { label: "Bestellung abgesendet", count: c["schritt_5_bestellung_abgesendet"] || 0 },
    ];
    const uploads = steps[0].count;
    const orders = steps[5].count;
    const total = Object.values(c).reduce((s, n) => s + n, 0);
    return {
      steps,
      max: Math.max(...steps.map(s => s.count), 1),
      total,
      conversion: uploads > 0 ? (orders / uploads) * 100 : 0,
      kiUsage: uploads > 0 ? ((c["schritt_2_ki_chat_gestartet"] || 0) / uploads) * 100 : 0,
    };
  }, [calcCounts]);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [rangeKey]);

  const stats = useMemo(() => {
    const total = views.length;
    const sessions = new Set(views.map(v => v.session_id).filter(Boolean)).size;
    const today = startOfDay(new Date()).getTime();
    const todayCount = views.filter(v => new Date(v.created_at).getTime() >= today).length;
    const avgPerDay = Math.round(total / range.days);
    return { total, sessions, todayCount, avgPerDay };
  }, [views, range.days]);

  const chartData = useMemo(() => {
    const buckets: Record<string, { date: string; views: number; visitors: Set<string> }> = {};
    for (let i = range.days - 1; i >= 0; i--) {
      const d = startOfDay(subDays(new Date(), i));
      const key = format(d, "yyyy-MM-dd");
      buckets[key] = { date: format(d, "dd.MM", { locale: de }), views: 0, visitors: new Set() };
    }
    for (const v of views) {
      const key = format(startOfDay(new Date(v.created_at)), "yyyy-MM-dd");
      if (buckets[key]) {
        buckets[key].views += 1;
        if (v.session_id) buckets[key].visitors.add(v.session_id);
      }
    }
    return Object.values(buckets).map(b => ({
      date: b.date,
      Aufrufe: b.views,
      Besucher: b.visitors.size,
    }));
  }, [views, range.days]);

  const topPages = useMemo(() => {
    const c: Record<string, number> = {};
    views.forEach(v => { c[v.path] = (c[v.path] || 0) + 1; });
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [views]);

  const topReferrers = useMemo(() => {
    const c: Record<string, number> = {};
    views.forEach(v => {
      const r = shortReferrer(v.referrer);
      c[r] = (c[r] || 0) + 1;
    });
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [views]);

  const deviceStats = useMemo(() => {
    const c: Record<string, number> = { desktop: 0, mobile: 0, tablet: 0 };
    views.forEach(v => {
      const d = (v.device || "desktop").toLowerCase();
      c[d] = (c[d] || 0) + 1;
    });
    const total = c.desktop + c.mobile + c.tablet || 1;
    return [
      { key: "desktop", label: "Desktop", count: c.desktop, pct: Math.round((c.desktop / total) * 100), Icon: Monitor },
      { key: "mobile", label: "Mobil", count: c.mobile, pct: Math.round((c.mobile / total) * 100), Icon: Smartphone },
      { key: "tablet", label: "Tablet", count: c.tablet, pct: Math.round((c.tablet / total) * 100), Icon: Tablet },
    ];
  }, [views]);

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-primary font-bold">Website</p>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">Analyse-Übersicht</h1>
          <p className="text-sm text-muted-foreground mt-1">Besucher, Aufrufe und beliebte Seiten deiner Website.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-muted rounded-lg p-1">
            {RANGES.map(r => (
              <button
                key={r.key}
                onClick={() => setRangeKey(r.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  rangeKey === r.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard icon={Eye} label="Seitenaufrufe" value={stats.total} hint={`${range.label}`} />
        <StatCard icon={Users} label="Eindeutige Besucher" value={stats.sessions} hint={`${range.label}`} />
        <StatCard icon={TrendingUp} label="Heute" value={stats.todayCount} hint="Aufrufe" />
        <StatCard icon={BarChart3} label="Ø pro Tag" value={stats.avgPerDay} hint={`${range.label}`} />
      </div>

      <Card className="p-4 md:p-6">
        <h2 className="font-heading text-lg font-bold flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" /> Herkunft der Anfragen
        </h2>
        <p className="text-xs text-muted-foreground mb-4">Letzte 90 Tage</p>
        {herkunftTotal < 3 ? (
          <p className="text-sm text-muted-foreground">
            Noch zu wenig Daten – wird nach den ersten Kalkulator-Abschlüssen erfasst
          </p>
        ) : (
          <div className="space-y-2">
            {herkunft.map(([label, count]) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-sm text-foreground w-28 shrink-0 truncate">{label}</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${(count / herkunft[0][1]) * 100}%` }}
                  />
                </div>
                <span className="text-sm text-muted-foreground tabular-nums w-8 text-right">{count}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4 md:p-6">
        <h2 className="font-heading text-lg font-bold mb-4">Verlauf</h2>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gViews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gVisitors" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Area type="monotone" dataKey="Aufrufe" stroke="hsl(var(--primary))" fill="url(#gViews)" strokeWidth={2} />
              <Area type="monotone" dataKey="Besucher" stroke="hsl(var(--foreground))" fill="url(#gVisitors)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <Card className="p-4 md:p-6">
          <h2 className="font-heading text-lg font-bold mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" /> Top-Seiten
          </h2>
          {topPages.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Daten.</p>
          ) : (
            <div className="space-y-2">
              {topPages.map(([path, count]) => {
                const max = topPages[0][1];
                return (
                  <div key={path} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-mono text-foreground truncate pr-2">{path === "/" ? "/ (Startseite)" : path}</span>
                      <span className="text-muted-foreground tabular-nums">{count}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${(count / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-4 md:p-6">
          <h2 className="font-heading text-lg font-bold mb-4 flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" /> Herkunft (Referrer)
          </h2>
          {topReferrers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Daten.</p>
          ) : (
            <div className="space-y-2">
              {topReferrers.map(([ref, count]) => {
                const max = topReferrers[0][1];
                return (
                  <div key={ref} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground truncate pr-2">{ref}</span>
                      <span className="text-muted-foreground tabular-nums">{count}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary/70 rounded-full" style={{ width: `${(count / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-4 md:p-6">
        <h2 className="font-heading text-lg font-bold mb-4">Geräte</h2>
        <div className="grid grid-cols-3 gap-3 md:gap-4">
          {deviceStats.map(d => (
            <div key={d.key} className="p-4 rounded-lg bg-muted/50 border border-border text-center">
              <d.Icon className="w-6 h-6 text-primary mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">{d.label}</p>
              <p className="text-xl font-bold text-foreground mt-1">{d.pct}%</p>
              <p className="text-[11px] text-muted-foreground">{d.count} Aufrufe</p>
            </div>
          ))}
        </div>
      </Card>

      <p className="text-[11px] text-muted-foreground text-center">
        Datenschutzfreundliches Eigen-Tracking. Keine Cookies, keine IP-Speicherung.
      </p>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, hint }: { icon: any; label: string; value: number; hint?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <p className="text-2xl font-bold text-foreground tabular-nums">{value.toLocaleString("de-CH")}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
    </Card>
  );
}
