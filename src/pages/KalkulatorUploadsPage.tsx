import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Download, Trash2, RefreshCw, Search, Upload as UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface CalcUpload {
  id: string;
  created_at: string;
  file_name: string;
  storage_path: string;
  bucket: string;
  size_bytes: number | null;
  material_name: string | null;
  color: string | null;
  infill: number | null;
  quantity: number | null;
  estimated_weight: number | null;
  customer_email: string | null;
  customer_name: string | null;
  status: string;
}

const formatBytes = (b: number | null) => {
  if (!b) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

const KalkulatorUploadsPage = () => {
  const [items, setItems] = useState<CalcUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("calculator_uploads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) toast.error("Fehler beim Laden");
    else setItems((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("calculator_uploads_admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "calculator_uploads" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleDownload = async (item: CalcUpload) => {
    const { data, error } = await supabase.storage
      .from(item.bucket || "project-uploads")
      .createSignedUrl(item.storage_path, 60 * 10);
    if (error || !data?.signedUrl) {
      toast.error("Download-Link konnte nicht erstellt werden");
      return;
    }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = item.file_name;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleDelete = async (item: CalcUpload) => {
    if (!confirm(`Datei "${item.file_name}" wirklich löschen?`)) return;
    await supabase.storage.from(item.bucket || "project-uploads").remove([item.storage_path]);
    const { error } = await supabase.from("calculator_uploads").delete().eq("id", item.id);
    if (error) toast.error("Löschen fehlgeschlagen");
    else {
      toast.success("Gelöscht");
      load();
    }
  };

  const filtered = items.filter((i) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      i.file_name.toLowerCase().includes(s) ||
      (i.customer_email || "").toLowerCase().includes(s) ||
      (i.material_name || "").toLowerCase().includes(s)
    );
  });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <UploadIcon className="w-6 h-6 text-primary" /> Kalkulator-Uploads
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Alle Dateien, die Besucher im Online-Kalkulator hochladen — sofort herunterladbar.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Aktualisieren
        </Button>
      </div>

      <div className="relative mb-4 max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Suchen nach Datei, Material, E-Mail…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Lade…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Noch keine Uploads vorhanden.</div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((item) => (
              <div key={item.id} className="p-4 flex flex-col md:flex-row md:items-center gap-3 hover:bg-muted/30">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{item.file_name}</span>
                    <Badge variant="secondary" className="text-[10px]">{formatBytes(item.size_bytes)}</Badge>
                    {item.status && <Badge variant="outline" className="text-[10px]">{item.status}</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                    <span>{format(new Date(item.created_at), "dd.MM.yyyy HH:mm", { locale: de })}</span>
                    {item.material_name && <span>Material: {item.material_name}</span>}
                    {item.color && <span>Farbe: {item.color}</span>}
                    {item.infill != null && <span>Infill: {item.infill}%</span>}
                    {item.quantity != null && <span>Menge: {item.quantity}</span>}
                    {item.estimated_weight != null && <span>~{Number(item.estimated_weight).toFixed(0)}g</span>}
                    {item.customer_email && <span className="text-primary">{item.customer_email}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button size="sm" variant="default" className="gap-1.5" onClick={() => handleDownload(item)}>
                    <Download className="w-4 h-4" /> Download
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(item)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default KalkulatorUploadsPage;
