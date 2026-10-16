import React, { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Download, Printer } from "lucide-react";
import { toast } from "sonner";

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/slicer-test`;
const QUALITIES = ["0.08", "0.12", "0.16", "0.20"];
const MAX_MB = 50;

interface SliceResult {
  job_id: string;
  quality: string;
  printer: string;
  slice_seconds?: number;
  stats?: { print_time_human?: string; filament_g?: number; layers?: number };
}

interface RunEntry {
  at: string;
  fileName: string;
  quality: string;
  result: SliceResult;
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    Authorization: `Bearer ${token ?? ""}`,
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
  };
}

function friendlyError(status: number, message?: string): string {
  if (status === 401 || status === 403) return "Keine Berechtigung (Admin-Anmeldung oder Slicer-Schlüssel prüfen).";
  if (status === 413) return `Die Datei ist zu gross (max. ${MAX_MB} MB).`;
  if (status === 504) return message ?? "Der Slicer hat nicht rechtzeitig geantwortet.";
  if (status === 422) return message ?? "Der Slicer konnte das Modell nicht verarbeiten.";
  return message ?? `Unerwarteter Fehler (${status}).`;
}

export default function SlicerTestPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [quality, setQuality] = useState("0.16");
  const [infill, setInfill] = useState("");
  const [walls, setWalls] = useState("");
  const [supports, setSupports] = useState(true);
  const [orient, setOrient] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SliceResult | null>(null);
  const [history, setHistory] = useState<RunEntry[]>([]);

  const runSlice = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResult(null);
    if (!file) return setError("Bitte zuerst ein Modell auswählen.");
    if (file.size > MAX_MB * 1024 * 1024) return setError(`Die Datei ist zu gross (max. ${MAX_MB} MB).`);

    const body = new FormData();
    body.append("file", file);
    body.append("quality", quality);
    if (infill.trim()) body.append("infill", infill.trim());
    if (walls.trim()) body.append("walls", walls.trim());
    body.append("supports", String(supports));
    body.append("orient", String(orient));

    setBusy(true);
    try {
      const res = await fetch(FUNCTION_URL, { method: "POST", headers: await authHeaders(), body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(friendlyError(res.status, data?.error));
        return;
      }
      setResult(data as SliceResult);
      setHistory((h) =>
        [{ at: new Date().toLocaleTimeString("de-CH"), fileName: file.name, quality, result: data as SliceResult }, ...h].slice(0, 10),
      );
    } catch {
      setError("Verbindung zur Funktion fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  const downloadGcode = async (r: SliceResult) => {
    try {
      const res = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: { ...(await authHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ action: "gcode", job_id: r.job_id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(friendlyError(res.status, data?.error));
        return;
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `${r.job_id.slice(0, 8)}_${r.printer}_${r.quality}mm.gcode`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Download fehlgeschlagen.");
    }
  };

  return (
    <div className="p-4 md:p-6 animate-fade-in space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Printer className="w-6 h-6" /> Slicer-Test
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Testet den Auto-Slicer auf dem NAS (Creality K1C, PLA). Es wird nichts gespeichert und nichts gedruckt.
        </p>
      </div>

      <form onSubmit={runSlice} className="bg-card border border-border rounded-lg p-5 space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Modell (STL, OBJ, 3MF, max. {MAX_MB} MB)</Label>
          <Input
            ref={fileRef}
            type="file"
            accept=".stl,.obj,.3mf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="bg-input border-border text-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Qualität (Schichthöhe mm)</Label>
            <select
              value={quality}
              onChange={(e) => setQuality(e.target.value)}
              className="w-full h-9 rounded-md bg-input border border-border px-2 text-sm"
            >
              {QUALITIES.map((q) => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Infill % (leer = Standard)</Label>
            <Input type="number" min={5} max={100} value={infill} onChange={(e) => setInfill(e.target.value)} className="bg-input border-border text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Wände (leer = Standard)</Label>
            <Input type="number" min={1} max={6} value={walls} onChange={(e) => setWalls(e.target.value)} className="bg-input border-border text-sm" />
          </div>
        </div>

        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={supports} onCheckedChange={setSupports} /> Stützen
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={orient} onCheckedChange={setOrient} /> Automatisch ausrichten
          </label>
        </div>

        <Button type="submit" disabled={busy} className="bg-primary hover:bg-primary/90 gap-2">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          {busy ? "Slicen läuft …" : "Slicen"}
        </Button>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>

      {result && (
        <div className="bg-card border border-primary/40 rounded-lg p-5 space-y-3">
          <h2 className="font-semibold text-sm">Ergebnis</h2>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div><dt className="text-xs text-muted-foreground">Druckzeit</dt><dd className="font-medium">{result.stats?.print_time_human ?? "–"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Filament</dt><dd className="font-medium">{result.stats?.filament_g != null ? `${result.stats.filament_g} g` : "–"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Schichten</dt><dd className="font-medium">{result.stats?.layers ?? "–"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Slice-Dauer</dt><dd className="font-medium">{result.slice_seconds != null ? `${result.slice_seconds} s` : "–"}</dd></div>
          </dl>
          <p className="text-xs text-muted-foreground break-all">Auftrag: {result.job_id}</p>
          <Button variant="outline" onClick={() => downloadGcode(result)} className="gap-2">
            <Download className="w-4 h-4" /> G-Code herunterladen
          </Button>
        </div>
      )}

      {history.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-5 space-y-2">
          <h2 className="font-semibold text-sm">Letzte Läufe (nur diese Sitzung)</h2>
          <ul className="divide-y divide-border text-sm">
            {history.map((h) => (
              <li key={h.result.job_id} className="py-2 flex flex-wrap items-center justify-between gap-2">
                <span className="truncate max-w-[50%]">{h.fileName}</span>
                <span className="text-muted-foreground">
                  {h.at} · {h.quality} mm · {h.result.stats?.print_time_human ?? "–"} · {h.result.stats?.filament_g ?? "–"} g
                </span>
                <Button size="sm" variant="ghost" onClick={() => downloadGcode(h.result)} className="gap-1">
                  <Download className="w-3.5 h-3.5" /> G-Code
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
