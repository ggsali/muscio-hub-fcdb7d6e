import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCHF } from "@/lib/calc";

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
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kunden</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{customers.length} Kunden total</p>
        </div>
        <Button onClick={() => navigate("/kunden/neu")} className="bg-primary hover:bg-primary/90 gap-2">
          <Plus className="w-4 h-4" />
          Neuer Kunde
        </Button>
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Name oder Firma suchen..."
            className="pl-9 bg-input border-border"
          />
        </div>
        <div className="flex gap-1">
          {(["alle", "aktiv", "inaktiv"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm rounded-md capitalize transition-colors ${
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
                  className="table-row-alt border-b border-border/50 last:border-0"
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
    </div>
  );
}
