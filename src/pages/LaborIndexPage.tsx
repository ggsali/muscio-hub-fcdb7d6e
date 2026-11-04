import { useCallback, useEffect, useState } from "react";
import { Link } from "@/lib/router-compat";
import { Trash2, Loader2, Calculator, Printer, PiggyBank } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNoIndex } from "@/hooks/useNoIndex";

interface LabJob {
  id: string;
  created_at: string;
  kind: "slicer" | "kalkulator" | "spardose";
  filename: string | null;
  settings: Record<string, any> | null;
  result: Record<string, any> | null;
  notes: string | null;
}

const KIND_LABEL: Record<LabJob["kind"], string> = {
  slicer: "Slicer",
  kalkulator: "Kalkulator",
  spardose: "Spardose",
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("de-CH", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Eine Zeile mit den wichtigsten Messwerten, egal aus welchem Test sie stammen */
function summarize(j: LabJob): string {
  const r = j.result ?? {};
  const parts: string[] = [];
  const grams = r.filamentGrams ?? r.stats?.filament_g;
  const minutes = r.printTimeMinutes ?? (r.stats?.print_time_s != null ? r.stats.print_time_s / 60 : null);
  if (grams != null) parts.push(`${Math.round(Number(grams) * 10) / 10} g`);
  if (minutes != null) parts.push(`${Math.floor(Number(minutes) / 60)} h ${Math.round(Number(minutes) % 60)} min`);
  const printer = r.printer ?? r.nas?.printer;
  if (printer) parts.push(String(printer));
  if (r.nas?.level) parts.push(String(r.nas.level));
  if (r.orientation?.name) parts.push(`Ausrichtung: ${r.orientation.name}`);
  if (r.hasSupport) parts.push("mit Stützen");
  return parts.join(" · ") || "–";
}

export default function LaborIndexPage() {
  useNoIndex();
  const [jobs, setJobs] = useState<LabJob[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from("lab_jobs")
      .select("id, created_at, kind, filename, settings, result, notes")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      setError("Testprotokoll nicht verfügbar (Migration lab_jobs angewendet?).");
      setJobs([]);
      return;
    }
    setError("");
    setJobs((data ?? []) as LabJob[]);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const remove = async (id: string) => {
    const { error } = await (supabase as any).from("lab_jobs").delete().eq("id", id);
    if (error) return toast.error("Löschen fehlgeschlagen.");
    setJobs((prev) => (prev ?? []).filter((j) => j.id !== id));
  };

  const tools = [
    { to: "/labor/kalkulator", label: "Kalkulator", icon: <Calculator className="w-5 h-5" />, text: "Kompletter Ablauf: Upload, Slicen auf dem Server, Preis" },
    { to: "/labor/slicer", label: "Slicer", icon: <Printer className="w-5 h-5" />, text: "Modell slicen, Werte und G-Code prüfen" },
    { to: "/labor/spardose", label: "Spardose", icon: <PiggyBank className="w-5 h-5" />, text: "Generator mit Plattenvorschau testen" },
  ];

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Labor</h1>
        <p className="text-sm text-muted-foreground">Testumgebung für Slicer, Kalkulator und neue Automatik. Getrennt von Kunden, Aufträgen und Rechnungen.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {tools.map((t) => (
          <Link key={t.to} to={t.to} className="rounded-xl border border-border bg-card p-4 hover:border-primary/50 transition-colors">
            <div className="flex items-center gap-2 font-medium">{t.icon}{t.label}</div>
            <p className="text-xs text-muted-foreground mt-1.5">{t.text}</p>
          </Link>
        ))}
      </div>

      <section>
        <h2 className="text-sm font-semibold mb-2">Testläufe</h2>
        {error && <p className="text-sm text-destructive mb-2">{error}</p>}
        {jobs === null ? (
          <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : jobs.length === 0 && !error ? (
          <p className="text-sm text-muted-foreground">Noch keine Testläufe. Sobald du im Slicer oder Kalkulator ein Modell slicest, erscheint es hier.</p>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            {jobs.map((j) => (
              <div key={j.id} className="flex items-center gap-3 px-3 py-2.5 border-b border-border last:border-b-0 text-sm">
                <span className="text-xs text-muted-foreground w-28 flex-shrink-0">{fmtDate(j.created_at)}</span>
                <span className="text-[10px] font-bold rounded-md bg-primary/10 text-primary px-1.5 py-0.5 flex-shrink-0">{KIND_LABEL[j.kind]}</span>
                <span className="truncate font-medium min-w-0 flex-1">{j.filename ?? "–"}</span>
                <span className="hidden md:block text-xs text-muted-foreground truncate max-w-[22rem]">{summarize(j)}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => remove(j.id)} aria-label="Testlauf löschen">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
