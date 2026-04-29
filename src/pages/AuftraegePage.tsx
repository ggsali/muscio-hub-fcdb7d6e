import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Trash2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCHF, formatPct } from "@/lib/calc";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";

interface Order {
  id: string;
  datum: string;
  beschreibung: string;
  umsatz_total: number;
  kosten_total: number;
  gewinn_total: number;
  marge: number;
  status: string;
  source: string;
  customer_name: string;
}

const STATUS_OPTIONS = ["Alle", "Offen", "In Bearbeitung", "Abgeschlossen", "Storniert"] as const;
const SOURCE_OPTIONS = ["Alle", "Manuell", "Website"] as const;

export default function AuftraegePage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Alle");
  const [sourceFilter, setSourceFilter] = useState<typeof SOURCE_OPTIONS[number]>("Alle");
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

  const handleDelete = async (orderId: string) => {
    await supabase.from("part_files").delete().eq("order_id", orderId);
    await supabase.from("parts").delete().eq("order_id", orderId);
    await supabase.from("order_status_log").delete().eq("order_id", orderId);
    await supabase.from("orders").delete().eq("id", orderId);
    setOrders(prev => prev.filter(o => o.id !== orderId));
    setDeleteId(null);
    toast({ title: "Auftrag gelöscht" });
  };

  const filtered = orders.filter(o => {
    const matchSearch =
      (o.beschreibung || "").toLowerCase().includes(search.toLowerCase()) ||
      o.customer_name.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "Alle" || o.status === filter;
    const matchSource =
      sourceFilter === "Alle" ||
      (sourceFilter === "Website" && o.source === "website") ||
      (sourceFilter === "Manuell" && (o.source === "manual" || !o.source));
    return matchSearch && matchFilter && matchSource;
  });

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Aufträge</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{orders.length} Aufträge total</p>
        </div>
        <Button onClick={() => navigate("/auftraege/neu")} className="bg-primary hover:bg-primary/90 gap-2" size={isMobile ? "sm" : "default"}>
          <Plus className="w-4 h-4" />
          {!isMobile && "Neuer Auftrag"}
          {isMobile && "Neu"}
        </Button>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Suche..."
            className="pl-9 bg-input border-border w-full"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                filter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-secondary"
              }`}
            >
              {s}
            </button>
          ))}
          <span className="w-px bg-border mx-1" />
          {SOURCE_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => setSourceFilter(s)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                sourceFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-secondary"
              }`}
            >
              {s === "Alle" ? "Quelle: Alle" : s}
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
            <div className="p-8 text-center text-muted-foreground text-sm">Keine Aufträge gefunden</div>
          ) : (
            filtered.map(o => (
              <div
                key={o.id}
                className="bg-card border border-border rounded-xl p-4 cursor-pointer active:bg-muted/40 transition-colors"
                onClick={() => navigate(`/auftraege/${o.id}`)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-sm truncate">{o.customer_name}</span>
                      <StatusBadge status={o.status} />
                      {o.source === "website" && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium">Website</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{o.beschreibung || "—"}</p>
                    <p className="text-xs text-muted-foreground mt-1">{o.datum}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-sm font-bold text-foreground">{formatCHF(o.umsatz_total)}</span>
                    <span className="text-xs text-success">{formatCHF(o.gewinn_total)}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                  <span className="text-xs text-muted-foreground">Marge: {formatPct(o.marge)}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={e => { e.stopPropagation(); setDeleteId(o.id); }}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1.5"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
            <div className="p-8 text-center text-muted-foreground text-sm">Keine Aufträge gefunden</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Datum", "Kunde", "Quelle", "Beschreibung", "Umsatz", "Kosten", "Gewinn", "Marge", "Status", ""].map(h => (
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
                    className="table-row-alt border-b border-border/50 last:border-0 cursor-pointer"
                    onClick={() => navigate(`/auftraege/${o.id}`)}
                  >
                    <td className="px-4 py-3 text-muted-foreground">{o.datum}</td>
                    <td className="px-4 py-3 font-medium">{o.customer_name}</td>
                    <td className="px-4 py-3">
                      {o.source === "website" ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium">Website</span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Manuell</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{o.beschreibung || "—"}</td>
                    <td className="px-4 py-3 num-right">{formatCHF(o.umsatz_total)}</td>
                    <td className="px-4 py-3 num-right text-destructive">{formatCHF(o.kosten_total)}</td>
                    <td className="px-4 py-3 num-right text-success">{formatCHF(o.gewinn_total)}</td>
                    <td className="px-4 py-3 num-right">{formatPct(o.marge)}</td>
                    <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setDeleteId(o.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1"
                        title="Auftrag löschen"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Auftrag löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dieser Auftrag und alle zugehörigen Teile und Dateien werden unwiderruflich gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
