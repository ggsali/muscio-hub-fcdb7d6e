import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@/lib/router-compat";
import { ShoppingBag, Search, ChevronRight, Printer } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatCHF } from "@/lib/calc";
import { cn } from "@/lib/utils";

type Typ = "shop" | "kalkulator";

interface CombinedRow {
  id: string;
  typ: Typ;
  datum: string;
  kunde: string;
  email: string;
  beschreibung: string;
  betrag: number;
  status: string;
  link: string;
}

const STATUS_OPTIONS = [
  "Alle Status", "Offen", "Bezahlt", "Abgeschlossen", "pending", "paid",
];

function statusClass(status: string) {
  const s = (status || "").toLowerCase();
  if (["paid", "bezahlt", "abgeschlossen", "delivered", "shipped"].includes(s))
    return "bg-green-500/15 text-green-400 border-green-500/30";
  if (["pending", "offen", "processing", "in bearbeitung"].includes(s))
    return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  if (["storniert", "cancelled", "canceled", "failed"].includes(s))
    return "bg-red-500/15 text-red-400 border-red-500/30";
  return "bg-muted text-muted-foreground border-border";
}

const StatusPill = ({ status }: { status: string }) => (
  <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize", statusClass(status))}>
    {status}
  </span>
);

const TypBadge = ({ typ }: { typ: Typ }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold",
      typ === "shop"
        ? "bg-green-500/15 text-green-400 border-green-500/30"
        : "bg-blue-500/15 text-blue-400 border-blue-500/30",
    )}
  >
    {typ === "shop" ? <ShoppingBag className="w-3 h-3" /> : <Printer className="w-3 h-3" />}
    {typ === "shop" ? "Shop" : "Kalkulator"}
  </span>
);

function formatDate(d: string) {
  if (!d) return "–";
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  return date.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function WebsiteBestellungenPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<CombinedRow[]>([]);
  const [counts, setCounts] = useState({ shop: 0, kalkulator: 0 });
  const [tab, setTab] = useState<"alle" | Typ>("alle");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Alle Status");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: kalkulatorOrders }, { data: shopOrders }] = await Promise.all([
        supabase
          .from("orders")
          .select("id, datum, created_at, name, umsatz_total, status, source, customers(name, vorname, email)")
          .eq("source", "website")
          .order("created_at", { ascending: false }),
        supabase
          .from("shop_orders")
          .select("id, created_at, customer_name, customer_email, total, status, stripe_session_id, shop_order_items(quantity, unit_price, shop_products(name))")
          .order("created_at", { ascending: false }),
      ]);

      const combined: CombinedRow[] = [
        ...(kalkulatorOrders || []).map((o: any) => ({
          id: o.id,
          typ: "kalkulator" as const,
          datum: o.created_at || o.datum,
          kunde: [o.customers?.vorname, o.customers?.name].filter(Boolean).join(" ") || "Kein Kunde",
          email: o.customers?.email || "–",
          beschreibung: o.name || "Kalkulator-Anfrage",
          betrag: o.umsatz_total || 0,
          status: o.status || "Offen",
          link: `/admin/auftraege/${o.id}`,
        })),
        ...(shopOrders || []).map((o: any) => ({
          id: o.id,
          typ: "shop" as const,
          datum: o.created_at,
          kunde: o.customer_name || "Gast",
          email: o.customer_email || "–",
          beschreibung:
            (o.shop_order_items || [])
              .map((i: any) => `${i.quantity}× ${i.shop_products?.name || "Produkt"}`)
              .join(", ") || "Shop-Bestellung",
          betrag: o.total || 0,
          status: o.status || "pending",
          link: `/admin/shop/bestellungen/${o.id}`,
        })),
      ].sort((a, b) => new Date(b.datum).getTime() - new Date(a.datum).getTime());

      setRows(combined);
      setCounts({ shop: shopOrders?.length || 0, kalkulator: kalkulatorOrders?.length || 0 });
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (tab !== "alle" && r.typ !== tab) return false;
      if (statusFilter !== "Alle Status" && (r.status || "").toLowerCase() !== statusFilter.toLowerCase()) return false;
      if (!q) return true;
      return (
        r.kunde.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.beschreibung.toLowerCase().includes(q)
      );
    });
  }, [rows, tab, search, statusFilter]);

  const TABS: { key: "alle" | Typ; label: string }[] = [
    { key: "alle", label: "Alle" },
    { key: "shop", label: "🛍️ Shop" },
    { key: "kalkulator", label: "🖨️ Kalkulator" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-primary" />
          Alle Bestellungen &amp; Anfragen
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {rows.length} total · {counts.shop} Shop · {counts.kalkulator} Kalkulator
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors",
              tab === t.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:bg-muted/40",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suche nach Kundenname, E-Mail, Beschreibung"
            className="pl-9 bg-input border-border w-full"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[200px] bg-input border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center text-muted-foreground text-sm">
          Laden...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center text-muted-foreground text-sm">
          Keine Bestellungen oder Anfragen gefunden
        </div>
      ) : (
        <>
          {/* Desktop-Tabelle */}
          <div className="hidden md:block bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">Typ</th>
                  <th className="text-left font-medium px-4 py-2.5">Datum</th>
                  <th className="text-left font-medium px-4 py-2.5">Kunde</th>
                  <th className="text-left font-medium px-4 py-2.5">Beschreibung</th>
                  <th className="text-right font-medium px-4 py-2.5">Betrag</th>
                  <th className="text-left font-medium px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filtered.map((r) => (
                  <tr
                    key={`${r.typ}-${r.id}`}
                    onClick={() => navigate(r.link)}
                    className="cursor-pointer hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3"><TypBadge typ={r.typ} /></td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(r.datum)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.kunde}</div>
                      <div className="text-xs text-muted-foreground">{r.email}</div>
                    </td>
                    <td className="px-4 py-3 max-w-[280px] truncate text-muted-foreground">{r.beschreibung}</td>
                    <td className="px-4 py-3 text-right font-bold whitespace-nowrap">{formatCHF(r.betrag)}</td>
                    <td className="px-4 py-3"><StatusPill status={r.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRight className="w-4 h-4 text-muted-foreground inline" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile-Cards */}
          <div className="md:hidden space-y-2">
            {filtered.map((r) => (
              <div
                key={`m-${r.typ}-${r.id}`}
                onClick={() => navigate(r.link)}
                className="bg-card border border-border rounded-lg p-3 cursor-pointer active:bg-muted/40 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <TypBadge typ={r.typ} />
                  <StatusPill status={r.status} />
                </div>
                <div className="font-medium text-sm">{r.kunde}</div>
                <div className="text-xs text-muted-foreground">{r.email}</div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.beschreibung}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px] text-muted-foreground">{formatDate(r.datum)}</span>
                  <span className="text-sm font-bold">{formatCHF(r.betrag)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
