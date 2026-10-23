import { useEffect, useState } from "react";
import { Plus, Trash2, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_VERSAND, loadVersandConfig, saveVersandConfig, type VersandConfig } from "@/lib/versandConfig";

export default function VersandPreiseCard() {
  const [c, setC] = useState<VersandConfig>(DEFAULT_VERSAND);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void loadVersandConfig().then(setC); }, []);
  const setT = (i: number, k: "name" | "bisKg" | "preis", v: string) =>
    setC((o) => ({ ...o, tarife: o.tarife.map((t, j) => (j === i ? { ...t, [k]: k === "name" ? v : parseFloat(v) || 0 } : t)) }));
  const save = async () => {
    setBusy(true);
    try { await saveVersandConfig(c); setC(await loadVersandConfig()); toast.success("Versand gespeichert"); }
    catch (e: any) { toast.error(e?.message || "Speichern fehlgeschlagen"); }
    setBusy(false);
  };
  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4 md:p-5">
      <div>
        <h3 className="text-sm font-semibold">Versandpreise &amp; Verpackung</h3>
        <p className="text-xs text-muted-foreground">Gilt für den Spardosen-Generator. Der Tarif wird nach Gesamtgewicht gewählt (erster Tarif, dessen Limit nicht überschritten ist).</p>
      </div>
      <div className="space-y-2">
        <div className="grid grid-cols-[1fr_90px_100px_36px] gap-2 text-xs text-muted-foreground"><span>Paketart</span><span>bis kg</span><span>Preis CHF</span><span /></div>
        {c.tarife.map((t, i) => (
          <div key={i} className="grid grid-cols-[1fr_90px_100px_36px] gap-2">
            <Input value={t.name} onChange={(e) => setT(i, "name", e.target.value)} placeholder="z. B. PostPac Priority" />
            <Input type="number" step="0.1" value={t.bisKg} onChange={(e) => setT(i, "bisKg", e.target.value)} className="text-right tabular-nums" />
            <Input type="number" step="0.05" value={t.preis} onChange={(e) => setT(i, "preis", e.target.value)} className="text-right tabular-nums" />
            <Button type="button" variant="ghost" size="icon" disabled={c.tarife.length <= 1} onClick={() => setC((o) => ({ ...o, tarife: o.tarife.filter((_, j) => j !== i) }))}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => setC((o) => ({ ...o, tarife: [...o.tarife, { name: "", bisKg: (o.tarife[o.tarife.length - 1]?.bisKg ?? 0) + 5, preis: 0 }] }))}><Plus className="mr-1 h-4 w-4" />Tarif hinzufügen</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div><Label className="text-xs">Verpackung pro Bestellung (CHF)</Label><Input type="number" step="0.05" value={c.verpackung} onChange={(e) => setC({ ...c, verpackung: parseFloat(e.target.value) || 0 })} /></div>
        <div><Label className="text-xs">Verpackung pro kg zusätzlich (CHF)</Label><Input type="number" step="0.05" value={c.verpackungProKg} onChange={(e) => setC({ ...c, verpackungProKg: parseFloat(e.target.value) || 0 })} /></div>
        <div><Label className="text-xs">Versand gratis ab (CHF)</Label><Input type="number" step="1" value={c.gratisAb ?? ""} placeholder="nie" onChange={(e) => setC({ ...c, gratisAb: e.target.value === "" ? null : parseFloat(e.target.value) || null })} /></div>
      </div>
      <Button onClick={save} disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Speichern</Button>
    </div>
  );
}
