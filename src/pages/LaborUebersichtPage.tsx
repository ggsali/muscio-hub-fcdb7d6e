import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Trash2, Workflow } from "lucide-react";
import { Link } from "@/lib/router-compat";

interface LabJob {
  id: string;
  kind: string;
  dateiname: string | null;
  einstellungen: any;
  ergebnis: any;
  status: string;
  fehler: string | null;
  created_at: string;
}

const KIND_LABEL: Record<string, { label: string; cls: string }> = {
  ablauf: { label: "Ablauf", cls: "bg-violet-500/15 text-violet-600 dark:text-violet-300 border-violet-500/30" },
  slicer: { label: "Slicer", cls: "bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/30" },
  kalkulator: { label: "Kalkulator", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30" },
  spardose: { label: "Spardose", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30" },
};

export default function LaborUebersichtPage() {
  const [jobs, setJobs] = useState<LabJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [offen, setOffen] = useState<string | null>(null);

  const laden = async () => {
    const { data, error } = await (supabase.from as any)("lab_jobs").select("*").order("created_at", { ascending: false }).limit(200);
    if (error) toast.error(`Testläufe konnten nicht geladen werden: ${error.message}`);
    setJobs((data ?? []) as LabJob[]);
    setLoading(false);
  };
  useEffect(() => { laden(); }, []);

  const loeschen = async (id: string) => {
    if (!confirm("Testlauf löschen?")) return;
    const { error } = await (supabase.from as any)("lab_jobs").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setJobs((j) => j.filter((x) => x.id !== id));
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Testläufe</h1>
          <p className="text-sm text-muted-foreground">Alles, was im Labor durchgespielt wurde. Nur Admin, ohne Kundendaten.</p>
        </div>
        <Link to="/labor/ablauf"><Button><Workflow className="h-4 w-4 mr-1" /> Neuer Ablauf</Button></Link>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Lade ...</div>
      ) : jobs.length === 0 ? (
        <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground text-center">Noch keine Testläufe.</div>
      ) : (
        <div className="rounded-xl border bg-card divide-y">
          {jobs.map((j) => {
            const k = KIND_LABEL[j.kind] ?? { label: j.kind, cls: "bg-muted text-muted-foreground border-border" };
            const p = j.ergebnis?.preis;
            return (
              <div key={j.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${k.cls}`}>{k.label}</span>
                  <div className="font-medium text-sm truncate flex-1 min-w-[10rem]">{j.dateiname ?? "ohne Datei"}</div>
                  {p?.proStueck != null && <div className="text-sm">CHF {Number(p.proStueck).toFixed(2)} / Stk.</div>}
                  <span className={`text-xs ${j.status === "fertig" ? "text-green-600" : j.status === "fehler" ? "text-destructive" : "text-amber-600"}`}>{j.status}</span>
                  <div className="text-xs text-muted-foreground">{new Date(j.created_at).toLocaleString("de-CH")}</div>
                  <Button variant="ghost" size="sm" onClick={() => setOffen(offen === j.id ? null : j.id)}>{offen === j.id ? "Schliessen" : "Details"}</Button>
                  <Button variant="ghost" size="icon" onClick={() => loeschen(j.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
                {j.fehler && <div className="text-xs text-destructive mt-1">{j.fehler}</div>}
                {offen === j.id && (
                  <pre className="mt-2 text-xs bg-muted rounded-md p-3 overflow-auto max-h-96">{JSON.stringify({ einstellungen: j.einstellungen, ergebnis: j.ergebnis }, null, 2)}</pre>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
