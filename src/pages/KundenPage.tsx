import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Plus, Search, ChevronRight, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCHF } from "@/lib/calc";
import { useIsMobile } from "@/hooks/use-mobile";

interface Customer {
  id: string;
  name: string;
  firma: string | null;
  email: string | null;
  telefon: string | null;
  aktiv: boolean;
  order_count?: number;
  total_umsatz?: number;
}

export default function KundenPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"alle" | "aktiv" | "inaktiv">("alle");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("customers")
        .select("*, orders(umsatz_total)")
        .order("created_at", { ascending: false });

      if (data) {
        const enriched = data.map(c => ({
          ...c,
          order_count: (c.orders as any[])?.length || 0,
          total_umsatz: (c.orders as any[])?.reduce((s: number, o: any) => s + (o.umsatz_total || 0), 0) || 0,
        }));
        setCustomers(enriched);
      }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = customers.filter(c => {
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.firma || "").toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "alle" ||
      (filter === "aktiv" && c.aktiv) ||
      (filter === "inaktiv" && !c.aktiv);
    return matchSearch && matchFilter;
  });

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Kunden</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{customers.length} Kunden total</p>
        </div>
        <Button onClick={() => navigate("/kunden/neu")} className="bg-primary hover:bg-primary/90 gap-2" size={isMobile ? "sm" : "default"}>
          <Plus className="w-4 h-4" />
          {isMobile ? "Neu" : "Neuer Kunde"}
        </Button>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Name oder Firma suchen..."
            className="pl-9 bg-input border-border w-full"
          />
        </div>
        <div className="flex gap-1.5">
          {(["alle", "aktiv", "inaktiv"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 text-xs rounded-md capitalize transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-secondary"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile: Card-Liste */}
      {isMobile ? (
        <div className="space-y-2">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Laden...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Keine Kunden gefunden</div>
          ) : (
            filtered.map(c => (
              <div
                key={c.id}
                className="bg-card border border-border rounded-xl p-4 cursor-pointer active:bg-muted/40 transition-colors"
                onClick={() => navigate(`/kunden/${c.id}`)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm">{c.name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${c.aktiv ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                        {c.aktiv ? "Aktiv" : "Inaktiv"}
                      </span>
                    </div>
                    {c.firma && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Building2 className="w-3 h-3" />
                        <span>{c.firma}</span>
                      </div>
                    )}
                    {c.email && <p className="text-xs text-muted-foreground mt-0.5 truncate">{c.email}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-sm font-bold">{formatCHF(c.total_umsatz || 0)}</span>
                    <span className="text-xs text-muted-foreground">{c.order_count} Aufträge</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Desktop: Tabelle */
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Laden...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Keine Kunden gefunden</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Name", "Firma", "E-Mail", "Telefon", "Aufträge", "Gesamtumsatz", "Status"].map(h => (
                    <th key={h} className={`px-5 py-3 text-muted-foreground font-medium ${h === "Gesamtumsatz" ? "text-right" : "text-left"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr
                    key={c.id}
                    className="table-row-alt border-b border-border/50 last:border-0 cursor-pointer"
                    onClick={() => navigate(`/kunden/${c.id}`)}
                  >
                    <td className="px-5 py-3 font-medium">{c.name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{c.firma || "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{c.email || "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{c.telefon || "—"}</td>
                    <td className="px-5 py-3">{c.order_count}</td>
                    <td className="px-5 py-3 num-right">{formatCHF(c.total_umsatz || 0)}</td>
                    <td className="px-5 py-3">
                      <span className={`status-badge ${c.aktiv ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-muted text-muted-foreground"}`}>
                        {c.aktiv ? "Aktiv" : "Inaktiv"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
