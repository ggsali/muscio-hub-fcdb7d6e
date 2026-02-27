import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCHF, formatPct } from "@/lib/calc";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

interface Order {
  id: string;
  datum: string;
  beschreibung: string;
  umsatz_total: number;
  kosten_total: number;
  gewinn_total: number;
  marge: number;
  status: string;
  customer_name: string;
}

const STATUS_OPTIONS = ["Alle", "Offen", "In Bearbeitung", "Abgeschlossen", "Storniert"] as const;

export default function AuftraegePage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Alle");
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("orders")
        .select("*, customers(name)")
        .order("datum", { ascending: false });

      if (data) {
        setOrders(data.map(o => ({
          ...o,
          customer_name: (o.customers as any)?.name || "Kein Kunde",
        })));
      }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = orders.filter(o => {
    const matchSearch =
      (o.beschreibung || "").toLowerCase().includes(search.toLowerCase()) ||
      o.customer_name.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "Alle" || o.status === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Aufträge</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{orders.length} Aufträge total</p>
        </div>
        <Button onClick={() => navigate("/auftraege/neu")} className="bg-primary hover:bg-primary/90 gap-2">
          <Plus className="w-4 h-4" />
          Neuer Auftrag
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Suche..."
            className="pl-9 bg-input border-border"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {STATUS_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                filter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-secondary"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Laden...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Keine Aufträge gefunden</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Datum", "Kunde", "Beschreibung", "Umsatz", "Kosten", "Gewinn", "Marge", "Status"].map(h => (
                  <th key={h} className={`px-4 py-3 text-muted-foreground font-medium ${["Umsatz", "Kosten", "Gewinn", "Marge"].includes(h) ? "text-right" : "text-left"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => (
                <tr
                  key={o.id}
                  className="table-row-alt border-b border-border/50 last:border-0"
                  onClick={() => navigate(`/auftraege/${o.id}`)}
                >
                  <td className="px-4 py-3 text-muted-foreground">{o.datum}</td>
                  <td className="px-4 py-3 font-medium">{o.customer_name}</td>
                  <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{o.beschreibung || "—"}</td>
                  <td className="px-4 py-3 num-right">{formatCHF(o.umsatz_total)}</td>
                  <td className="px-4 py-3 num-right text-destructive">{formatCHF(o.kosten_total)}</td>
                  <td className="px-4 py-3 num-right text-success">{formatCHF(o.gewinn_total)}</td>
                  <td className="px-4 py-3 num-right">{formatPct(o.marge)}</td>
                  <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
