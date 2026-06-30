import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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

export default function DruckplattenPage() {
  const { toast } = useToast();
  const [plates, setPlates] = useState<any[]>([]);
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
      supabase.from("orders").select("id, name, beschreibung, datum"),
    ]);
    setPlates((pl as any) || []);
    setPrinters((eq as any) || []);
    setOrders((o as any) || []);
    if (pl && pl.length) {
      const { data: pp } = await supabase.from("print_plate_parts").select("plate_id, menge").in("plate_id", pl.map((p: any) => p.id));
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

  const handleZip = async (plateId: string) => {
    setZipping(plateId);
    const { data, error } = await supabase.functions.invoke("generate-plate-zip", { body: { plateId } });
    setZipping(null);
    if (error || data?.error) {
      toast({ title: "ZIP-Fehler", description: data?.error || error?.message, variant: "destructive" });
      return;
    }
    if (data?.url) window.open(data.url, "_blank");
    load();
  };

  const handleDownload = async (path: string) => {
    const { data } = await supabase.storage.from("print-plates").createSignedUrl(path, 60 * 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const handleDelete = async (plate: any) => {
    if (!confirm("Druckplatte löschen?")) return;
    if (plate.zip_path) await supabase.storage.from("print-plates").remove([plate.zip_path]);
    await supabase.from("print_plates").delete().eq("id", plate.id);
    load();
  };

  const filtered = filterStatus ? plates.filter(p => p.status === filterStatus) : plates;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold">Druckplatten</h1>
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Alle Status</option>
          {STATUS.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Laden…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center text-sm text-muted-foreground">
          Noch keine Druckplatten erstellt.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(plate => {
            const printer = printers.find(p => p.id === plate.equipment_id);
            const order = orders.find(o => o.id === plate.order_id);
            return (
              <div key={plate.id} className="bg-card border border-border rounded-lg p-4 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{plate.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted uppercase">{STATUS_LABEL[plate.status] || plate.status}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {printer?.name || "—"} · {counts[plate.id] || 0} Teile
                    {order && <> · <Link to={`/admin/auftraege/${order.id}`} className="text-primary hover:underline inline-flex items-center gap-0.5">{order.name || order.beschreibung || order.datum} <ExternalLink className="w-3 h-3" /></Link></>}
                  </p>
                </div>
                <select
                  value={plate.status}
                  onChange={e => updateStatus(plate.id, e.target.value)}
                  className="h-8 rounded border border-input bg-background px-2 text-xs"
                >
                  {STATUS.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
                {plate.zip_path && (
                  <Button size="sm" variant="outline" onClick={() => handleDownload(plate.zip_path)}>
                    <Download className="w-3.5 h-3.5" /> ZIP
                  </Button>
                )}
                <Button size="sm" onClick={() => handleZip(plate.id)} disabled={zipping === plate.id}>
                  {zipping === plate.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  {plate.zip_path ? "Neu generieren" : "ZIP erstellen"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(plate)}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
