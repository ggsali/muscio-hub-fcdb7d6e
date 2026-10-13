import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, MapPin } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/admin/stadtmodelle")({
  head: () => ({ meta: [{ title: "Stadtmodelle | 3DMuscio Admin" }] }),
  component: StadtmodellePage,
});

const STATUS: Record<string, string> = { offen: "Offen (unbezahlt)", bezahlt: "Bezahlt", im_druck: "Im Druck", versandt: "Versandt", fehler: "Fehler" };

function StadtmodellePage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["stadtmodelle"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stadtmodell_bestellungen").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from("stadtmodell_bestellungen").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error("Status konnte nicht gespeichert werden");
    qc.invalidateQueries({ queryKey: ["stadtmodelle"] });
  }
  async function download(path: string) {
    const { data, error } = await supabase.storage.from("stadtmodelle").createSignedUrl(path, 300, { download: true });
    if (error || !data) return toast.error("Datei nicht verfügbar");
    window.open(data.signedUrl, "_blank");
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <h1 className="text-2xl font-bold">Stadtmodelle</h1>
      {isLoading ? <p className="text-muted-foreground">Lade …</p> : data.length === 0 ? <p className="text-muted-foreground">Noch keine Bestellungen.</p> : (
        <div className="grid gap-3">
          {data.map((b) => (
            <div key={b.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 md:flex-row md:items-center">
              <div className="flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{b.kunde_name || "—"}</span>
                  <span className="text-sm text-muted-foreground">{b.kunde_email}</span>
                  <Badge variant={b.status === "fehler" ? "destructive" : "secondary"}>{STATUS[b.status] ?? b.status}</Badge>
                </div>
                <p className="text-sm">{b.kantenlaenge_m} m · 1:{b.massstab} · {b.modell_mm}×{b.modell_mm} mm · Sockel {b.sockel_mm} mm · {b.material} · <b>CHF {Number(b.preis).toFixed(2)}</b>{b.versandart ? <> · {b.versandart} (CHF {Number(b.versandkosten ?? 0).toFixed(2)})</> : null}</p>
                <p className="text-xs text-muted-foreground">{new Date(b.created_at).toLocaleString("de-CH")}{b.fehler ? ` · ${b.fehler}` : ""}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" asChild>
                  <a href={`https://map.geo.admin.ch/?lang=de&swisssearch=${b.lat},${b.lon}`} target="_blank" rel="noreferrer"><MapPin className="mr-1 h-4 w-4" />Karte</a>
                </Button>
                {b.stl_path && <Button size="sm" onClick={() => download(b.stl_path!)}><Download className="mr-1 h-4 w-4" />STL</Button>}
                <Select value={b.status} onValueChange={(v) => setStatus(b.id, v)}>
                  <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(STATUS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
