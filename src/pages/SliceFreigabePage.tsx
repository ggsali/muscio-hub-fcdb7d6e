import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2, Download, Check, X, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/slice-decision`;
const PRINTER_LABELS: Record<string, string> = { k1c: "Creality K1C", k1: "Creality K1", a1: "Bambu Lab A1" };
const STATUS_LABELS: Record<string, string> = {
  slicing: "Wird geslict …",
  pending: "Wartet auf Freigabe",
  approved: "Freigegeben",
  rejected: "Abgelehnt",
  failed: "Fehlgeschlagen",
};

interface SliceJob {
  id: string;
  inquiry_id: string | null;
  filename: string;
  quantity: number;
  material: string | null;
  farbe: string | null;
  layer_height: number | null;
  infill: number | null;
  printer: string | null;
  nas_job_id: string | null;
  stats: { print_time_human?: string; filament_g?: number; layers?: number } | null;
  assessment: { easy?: boolean; level?: string; reasons?: string[] } | null;
  status: string;
  error: string | null;
  created_at: string;
  inquiries?: { name: string | null; email: string | null; betreff: string | null } | null;
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  return {
    Authorization: `Bearer ${data.session?.access_token ?? ""}`,
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
    "Content-Type": "application/json",
  };
}

async function callDecision(action: string, id: string): Promise<Response> {
  return fetch(FUNCTION_URL, { method: "POST", headers: await authHeaders(), body: JSON.stringify({ action, id }) });
}

export default function SliceFreigabePage() {
  const [jobs, setJobs] = useState<SliceJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [publicSlice, setPublicSlice] = useState(false);
  const [debugLog, setDebugLog] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const db = supabase as any;
    const { data, error: err } = await db
      .from("slice_jobs")
      .select("*, inquiries(name, email, betreff)")
      .order("created_at", { ascending: false })
      .limit(50);
    if (err) setError(err.message);
    else setJobs((data ?? []) as SliceJob[]);
    const { data: flag } = await db.from("settings").select("value").eq("key", "auto_slice_enabled").maybeSingle();
    setEnabled(flag?.value === "true");
    const { data: pflag } = await db.from("settings").select("value").eq("key", "public_nas_slice_enabled").maybeSingle();
    setPublicSlice(pflag?.value === "true");
    const { data: dl } = await db.from("settings").select("value").eq("key", "slice_debug_log").maybeSingle();
    try {
      const arr = JSON.parse(dl?.value ?? "[]") as Array<Record<string, unknown>>;
      setDebugLog(arr.slice().reverse().map((e) => JSON.stringify(e)).join("\n"));
    } catch { setDebugLog(dl?.value ?? ""); }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleEnabled = async (on: boolean) => {
    setEnabled(on);
    const { error: err } = await (supabase as any)
      .from("settings")
      .upsert({ key: "auto_slice_enabled", value: on ? "true" : "false" }, { onConflict: "key" });
    if (err) {
      setEnabled(!on);
      toast.error("Schalter konnte nicht gespeichert werden");
    } else {
      toast.success(on ? "Automatik ist eingeschaltet" : "Automatik ist ausgeschaltet");
    }
  };

  const togglePublic = async (on: boolean) => {
    setPublicSlice(on);
    const { error: err } = await (supabase as any)
      .from("settings")
      .upsert({ key: "public_nas_slice_enabled", value: on ? "true" : "false" }, { onConflict: "key" });
    if (err) {
      setPublicSlice(!on);
      toast.error("Schalter konnte nicht gespeichert werden");
    } else {
      toast.success(on ? "Online-Kalkulator slict jetzt über den NAS" : "Online-Kalkulator nutzt wieder den Browser-Slicer");
    }
  };

  const decide = async (job: SliceJob, action: "approve" | "reject") => {
    const warn = job.assessment?.easy === true ? "" : "\n\n⚠️ Die automatische Analyse stuft das Teil als KOMPLIZIERT ein" + (job.assessment?.reasons?.length ? ` (${job.assessment.reasons.join(", ")})` : "") + ".";
    if (action === "approve" && !window.confirm(`"${job.filename}" jetzt in die SimplyPrint-Queue stellen? Der Drucker startet, sobald er frei ist.${warn}`)) return;
    setBusy(job.id);
    try {
      const res = await callDecision(action, job.id);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? `Fehler ${res.status}`);
      } else {
        toast.success(action === "approve" ? "In SimplyPrint eingereiht" : "Abgelehnt");
        await load();
      }
    } catch {
      toast.error("Verbindung fehlgeschlagen");
    } finally {
      setBusy(null);
    }
  };

  const download = async (job: SliceJob) => {
    setBusy(job.id);
    try {
      const res = await callDecision("gcode", job.id);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error ?? `Fehler ${res.status}`);
        return;
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `${job.filename.replace(/\.[^.]+$/, "")}_${job.printer ?? "drucker"}.gcode`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold">Slice-Freigabe</h1>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={enabled} onCheckedChange={toggleEnabled} />
            Automatik für neue Anfragen
          </label>
          <Button variant="outline" size="sm" onClick={() => void load()} className="gap-2">
            <RefreshCw className="w-4 h-4" /> Aktualisieren
          </Button>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={publicSlice} onCheckedChange={togglePublic} />
        Online-Kalkulator: alles über den NAS-Slicer (aus = alles im Browser)
      </label>
      <p className="text-sm text-muted-foreground">
        Die Automatik für neue Anfragen ist aktuell nicht an das Live-Formular angeschlossen: Neue Anfragen erscheinen hier nicht und es wird keine Freigabe-Mail verschickt.
        Freigaben gelten nur für Jobs, die aus dem Test-Kalkulator kommen. Nach Freigabe kommt das Teil in die SimplyPrint-Queue des gewählten Druckers.
      </p>

      {loading && (
        <p className="flex items-center gap-2 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Lädt …
        </p>
      )}
      {error && <p className="text-sm text-destructive">Fehler: {error}</p>}
      {!loading && !error && jobs.length === 0 && (
        <p className="text-sm text-muted-foreground">Noch keine geslicten Anfragen.</p>
      )}

      <details className="rounded-lg border border-border p-3 text-xs">
        <summary className="cursor-pointer font-medium">Debug-Protokoll Online-Kalkulator (neueste zuerst)</summary>
        <div className="mt-2 space-y-2">
          <Button variant="outline" size="sm" onClick={() => { void navigator.clipboard.writeText(debugLog); toast.success("Kopiert"); }}>Kopieren</Button>
          <pre className="whitespace-pre-wrap break-all max-h-80 overflow-auto">{debugLog || "Noch keine Einträge. Datei im Kalkulator hochladen und hier «Aktualisieren» klicken."}</pre>
        </div>
      </details>

      <div className="space-y-3">
        {jobs.map((job) => {
          const easy = job.assessment?.easy === true;
          return (
            <div key={job.id} className="rounded-lg border border-border p-4 space-y-2">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-medium">{job.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {job.inquiries?.name ?? "–"} · {job.inquiries?.email ?? "–"} · {new Date(job.created_at).toLocaleString("de-CH")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {job.quantity}× · {job.material ?? "–"} {job.farbe ?? ""} · {job.layer_height ?? "–"} mm · {job.infill ?? "–"} % Infill
                  </p>
                </div>
                <span className="text-xs rounded-full border border-border px-2 py-0.5">{STATUS_LABELS[job.status] ?? job.status}</span>
              </div>

              {job.status === "failed" && <p className="text-sm text-destructive">{job.error ?? "Unbekannter Fehler"}</p>}

              {job.stats && (
                <p className="text-sm">
                  Drucker: <b>{PRINTER_LABELS[job.printer ?? ""] ?? job.printer ?? "–"}</b> · Druckzeit {job.stats.print_time_human ?? "–"} ·{" "}
                  {job.stats.filament_g ?? "–"} g · {job.stats.layers ?? "–"} Schichten
                </p>
              )}
              {job.assessment && (
                <p className={`text-sm ${easy ? "text-green-600" : "text-orange-500"}`}>
                  Einschätzung: {job.assessment.level ?? (easy ? "einfach" : "kompliziert")}
                  {job.assessment.reasons?.length ? ` – ${job.assessment.reasons.join(", ")}` : ""}
                </p>
              )}

              {!!job.nas_job_id && job.status !== "failed" && job.status !== "slicing" && (
                <div className="flex gap-2 flex-wrap pt-1">
                  <Button variant="outline" size="sm" disabled={busy === job.id} onClick={() => void download(job)} className="gap-2">
                    <Download className="w-4 h-4" /> G-Code laden
                  </Button>
                  {job.status === "pending" && (
                    <>
                      <Button size="sm" disabled={busy === job.id} onClick={() => void decide(job, "approve")} className="gap-2">
                        {busy === job.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Freigeben und drucken
                      </Button>
                      <Button variant="outline" size="sm" disabled={busy === job.id} onClick={() => void decide(job, "reject")} className="gap-2">
                        <X className="w-4 h-4" /> Ablehnen
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
