import { useEffect, useState } from "react";
import { Loader2, Cpu } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { SCHICHTHOEHEN, sliceDatei, type AdminSliceResult } from "@/lib/sliceAdmin";

export interface SliceFile { filename: string; storage_path: string }

interface Props {
  open: boolean;
  onClose: () => void;
  teilname: string;
  files: SliceFile[];
  defaultInfill?: number;
  onApply: (r: AdminSliceResult, ctx: { schichthoehe: string; infill: number }) => void;
}

const fmtZeit = (s: number) => `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min`;

/** Teil aus dem Auftrag auf dem Slicer-Server slicen: Datei, Schichthöhe und Infill wählen, Ergebnis ins Teil übernehmen. */
export default function PartSliceDialog({ open, onClose, teilname, files, defaultInfill = 20, onApply }: Props) {
  const [fileIdx, setFileIdx] = useState(0);
  const [schicht, setSchicht] = useState<string>("0.20");
  const [infill, setInfill] = useState(defaultInfill);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AdminSliceResult | null>(null);

  useEffect(() => { if (open) { setFileIdx(0); setError(null); setResult(null); setInfill(defaultInfill); } }, [open, defaultInfill]);

  const run = async () => {
    const f = files[fileIdx];
    if (!f) return;
    setBusy(true); setError(null); setResult(null);
    try {
      const { data, error: dlErr } = await supabase.storage.from("part-files").download(f.storage_path);
      if (dlErr || !data) throw new Error(`Datei konnte nicht geladen werden: ${dlErr?.message ?? "unbekannt"}`);
      const r = await sliceDatei(new File([data], f.filename), schicht, infill);
      setResult(r);
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Cpu className="w-4 h-4" /> Teil slicen: {teilname || "Teil"}</DialogTitle></DialogHeader>
        {files.length === 0 ? (
          <p className="text-sm text-muted-foreground">Zu diesem Teil ist noch keine STL-, OBJ- oder 3MF-Datei hochgeladen (Büroklammer-Symbol).</p>
        ) : (
          <div className="space-y-3">
            {files.length > 1 && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Datei</label>
                <select value={fileIdx} onChange={(e) => setFileIdx(Number(e.target.value))} className="w-full h-10 rounded-md border border-border bg-input px-3 text-sm">
                  {files.map((f, i) => <option key={f.storage_path} value={i}>{f.filename}</option>)}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Schichthöhe</label>
                <select value={schicht} onChange={(e) => setSchicht(e.target.value)} className="w-full h-10 rounded-md border border-border bg-input px-3 text-sm">
                  {SCHICHTHOEHEN.map((h) => <option key={h} value={h}>{h} mm</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Infill (%)</label>
                <input type="number" min={5} max={100} value={infill} onChange={(e) => setInfill(Math.max(5, Math.min(100, Number(e.target.value) || 20)))} className="w-full h-10 rounded-md border border-border bg-input px-3 text-sm" />
              </div>
            </div>
            <Button onClick={run} disabled={busy} className="w-full gap-2">
              {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Wird gesliced…</> : "Jetzt slicen"}
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {result && (
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm space-y-1">
                <p>Druckzeit: <b>{fmtZeit(result.printTimeS)}</b> · Filament: <b>{result.filamentG.toFixed(1)} g</b></p>
                <p className="text-muted-foreground">{result.layers ? `${result.layers} Layer · ` : ""}Stützstrukturen: {result.hasSupport ? "ja" : "nein"}{result.splitParts ? ` · geteilt in ${result.splitParts} Teile` : ""}</p>
                <Button size="sm" className="w-full mt-2" onClick={() => { onApply(result, { schichthoehe: schicht, infill }); onClose(); }}>
                  Ins Teil übernehmen (Gewicht und Druckzeit)
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
