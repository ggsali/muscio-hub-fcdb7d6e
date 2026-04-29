import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Globe, Search, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCHF } from "@/lib/calc";

interface Order {
  id: string;
  datum: string;
  beschreibung: string;
  umsatz_total: number;
  status: string;
  source: string;
  customer_name: string;
}

export default function WebsiteOrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("orders")
        .select("*, customers(name, vorname)")
        .eq("source", "website")
        .order("datum", { ascending: false });
      if (data) {
        setOrders(data.map((o: any) => ({
          ...o,
          customer_name: [o.customers?.vorname, o.customers?.name].filter(Boolean).join(" ") || "Kein Kunde",
        })));
      }
      setLoading(false);
    })();
  }, []);

  const filtered = orders.filter(o =>
    (o.beschreibung || "").toLowerCase().includes(search.toLowerCase()) ||
    o.customer_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
          <Globe className="w-5 h-5 text-primary" />
          Website-Bestellungen
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {orders.length} Bestellungen über den Online-Kalkulator
        </p>
      </div>

      <div className="relative w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Suche..."
          className="pl-9 bg-input border-border w-full"
        />
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Laden...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            Noch keine Website-Bestellungen
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {filtered.map(o => (
              <div
                key={o.id}
                onClick={() => navigate(`/auftraege/${o.id}`)}
                className="p-4 flex items-center gap-4 cursor-pointer hover:bg-muted/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{o.customer_name}</span>
                    <StatusBadge status={o.status} />
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium">Website</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{o.beschreibung || "—"}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{o.datum}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-bold">{formatCHF(o.umsatz_total)}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
