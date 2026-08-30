import React, { useEffect, useMemo, useState } from "react";
import { Link } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Layers, Download, Loader2, ExternalLink, Trash2 } from "lucide-react";

const STATUS = ["geplant", "zip_erstellt", "im_druck", "fertig", "abgebrochen"] as const;
const STATUS_LABEL: Record<string, string> = {
  geplant: "Geplant",
  zip_erstellt: "ZIP erstellt",
  im_druck: "Im Druck",
  fertig: "Fertig",
  abgebrochen: "Abgebrochen",
};

type Plate = {
  id: string; name: string; equipment_id: string | null;
  order_id: string; status: string; created_at: string;
};

export default function DruckplattenPage() {
  const { toast } = useToast();
  const [plates, setPlates] = useState<Plate[]>([]);
  const [printers, setPrinters] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [zipping, setZipping] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("");

  const load = async () => {
    setLoading(true);
    const [{ data: pl }, { data: eq }, { data: o }] = await Promise.all([
      supabase.from("print_plates").select("*").order("created_at", { ascending: false }),
      supabase.from("equipment").select("id, name").eq("ist_drucker", true),
      supabase.from("orders").select("id, name, beschreibung, datum, customers(name, vorname)"),
    ]);
    setPlates((pl as any) || []);
    setPrinters((eq as any) || []);
    setOrders((o as any) || []);
    if (pl && pl.length) {
      const { data: pp } = await supabase
        .from("print_plate_parts").select("plate_id, menge")
        .in("plate_id", pl.map((p: any) => p.id));
      const c: Record<string, number> = {};
      for (const r of (pp as any) || []) c[r.plate_id] = (c[r.plate_id] || 0) + (r.menge || 1);
      setCounts(c);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("print_plates").update({ status }).eq("id", id);
    load();
  };

  const handleZip = async (orderId: string) => {
    setZipping(orderId);
    const { data, error } = await supabase.functions.invoke("generate-plate-zip", { body: { orderId } });
    setZipping(null);
    if (error || data?.error) {
      toast({ title: "ZIP-Fehler", description: data?.error || error?.message, variant: "destructive" });
      return;
    }
    if (data?.url) window.open(data.url, "_blank");
  };

  const handleDeletePlate = async (plate: Plate) => {
    if (!confirm("Diese Platte löschen?")) return;
    await supabase.from("print_plates").delete().eq("id", plate.id);
    load();
  };

  // Gruppieren nach Auftrag
  const grouped = useMemo(() => {
    const m = new Map<string, Plate[]>();
    for (const p of plates) {
      if (filterStatus && p.status !== filterStatus) continue;
      if (!m.has(p.order_id)) m.set(p.order_id, []);
      m.get(p.order_id)!.push(p);
    }
    return Array.from(m.entries());
  }, [plates, filterStatus]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold">Druckplatten</h1>
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Alle Status</option>
          {STATUS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Laden…</div>
      ) : grouped.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center text-sm text-muted-foreground">
          Noch keine Druckplatten erstellt.
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(([orderId, orderPlates]) => {
            const order = orders.find((o) => o.id === orderId);
            const printerSummary = Array.from(
              new Set(orderPlates.map((p) => printers.find((eq) => eq.id === p.equipment_id)?.name).filter(Boolean)),
            ).join(", ");
            const totalParts = orderPlates.reduce((s, p) => s + (counts[p.id] || 0), 0);
            return (
              <div key={orderId} className="bg-card border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="flex-1 min-w-[220px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link to={`/admin/auftraege/${orderId}`} className="font-semibold hover:text-primary inline-flex items-center gap-1">
                        {order?.name || order?.beschreibung || orderId.slice(0, 8).toUpperCase()}
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                      {order?.customers?.name && (
                        <span className="text-xs text-muted-foreground">
                          · {order.customers.vorname || ""} {order.customers.name}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {orderPlates.length} {orderPlates.length === 1 ? "Platte" : "Platten"} · {totalParts} Teile
                      {printerSummary && <> · {printerSummary}</>}
                    </p>
                  </div>
                  <Link to={`/admin/auftraege/${orderId}/platten`}>
                    <Button size="sm" variant="outline">Bearbeiten</Button>
                  </Link>
                  <Button size="sm" onClick={() => handleZip(orderId)} disabled={zipping === orderId}>
                    {zipping === orderId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    Gesamt-ZIP
                  </Button>
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {orderPlates.map((p, idx) => {
                    const printer = printers.find((eq) => eq.id === p.equipment_id);
                    return (
                      <div key={p.id} className="flex items-center gap-2 bg-muted/30 border border-border rounded px-2 py-1.5 text-xs">
                        <span className="font-medium">Platte {idx + 1}</span>
                        <span className="text-muted-foreground truncate flex-1">{printer?.name || "—"}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-background border border-border uppercase">
                          {counts[p.id] || 0}T
                        </span>
                        <select
                          value={p.status}
                          onChange={(e) => updateStatus(p.id, e.target.value)}
                          className="h-6 rounded border border-input bg-background px-1 text-[10px]"
                        >
                          {STATUS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                        </select>
                        <button onClick={() => handleDeletePlate(p)} className="text-destructive hover:opacity-80">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
