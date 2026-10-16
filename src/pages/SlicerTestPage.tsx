import React, { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/contexts/SettingsContext";
import { calcUmsatz, calcKosten, calcGewinn, calcMarge, formatCHF, formatPct } from "@/lib/calc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Download, Printer, RotateCcw } from "lucide-react";
import { toast } from "sonner";

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/slicer-test`;
const QUALITIES = ["0.08", "0.12", "0.16", "0.20"];
const MAX_MB = 50;

interface SliceResult {
  job_id: string;
  quality: string;
  printer: string;
  slice_seconds?: number;
  stats?: { print_time_human?: string; print_time_s?: number; filament_g?: number; layers?: number };
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  return {
    Authorization: `Bearer ${data.session?.access_token ?? ""}`,
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
  const { settings } = useSettings();
  const fileRef = useRef<HTMLInputElement>(null);

  // Slicer-Eingaben
  const [file, setFile] = useState<File | null>(null);
  const [quality, setQuality] = useState("0.16");
  const [infill, setInfill] = useState("");
  const [walls, setWalls] = useState("");
  const [supports, setSupports] = useState(true);
  const [orient, setOrient] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SliceResult | null>(null);

  // Kalkulator-Eingaben (Gewicht und Druckzeit kommen vom Slicer, bleiben aber editierbar)
  const [gewicht, setGewicht] = useState(0);
  const [druckzeit, setDruckzeit] = useState(0);
  const [nachbearbeitung, setNachbearbeitung] = useState(0);
  const [konstruktion, setKonstruktion] = useState(0);
  const [menge, setMenge] = useState(1);

  const preisPro = calcUmsatz(settings, gewicht, druckzeit, nachbearbeitung, konstruktion);
  const preisTotal = preisPro * menge;
  const kosten = calcKosten(settings, gewicht, druckzeit) * menge;
  const gewinn = calcGewinn(preisTotal, kosten);
  const marge = calcMarge(gewinn, preisTotal);

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
      const r = data as SliceResult;
      setResult(r);
      // Werte automatisch in den Kalkulator übernehmen
      if (r.stats?.filament_g != null) setGewicht(Math.round(r.stats.filament_g * 10) / 10);
      if (r.stats?.print_time_s != null) setDruckzeit(Math.round((r.stats.print_time_s / 3600) * 100) / 100);
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

  const reset = () => {
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
    setResult(null);
    setError("");
    setInfill("");
    setWalls("");
    setGewicht(0);
    setDruckzeit(0);
    setNachbearbeitung(0);
    setKonstruktion(0);
    setMenge(1);
  };

  const numField = (label: string, value: number, setter: (v: number) => void, step = 0.1, unit = "") => (
    <div className="space-y-1.5">
      <Label className="text-sm">
        {label}
        {unit && <span className="text-muted-foreground ml-1">({unit})</span>}
      </Label>
      <Input
        type="number"
        value={value || ""}
        onChange={(e) => setter(parseFloat(e.target.value) || 0)}
        step={step}
        min={0}
        className="bg-input border-border text-lg h-11 tabular-nums"
        placeholder="0"
      />
    </div>
  );

  return (
    <div className="p-4 md:p-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Printer className="w-6 h-6" /> Slicer-Test
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Modell hochladen, auf dem NAS slicen und den Preis wie im Kalkulator berechnen (Creality K1C, PLA). Nichts wird gespeichert oder gedruckt.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl">
        {/* Eingabe */}
        <div className="space-y-6">
          <form onSubmit={runSlice} className="bg-card border border-border rounded-lg p-5 space-y-4">
            <h2 className="font-semibold">1. Slicen</h2>
            <div className="space-y-1.5">
              <Label className="text-sm">Modell (STL, OBJ, 3MF, max. {MAX_MB} MB)</Label>
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
                <Label className="text-sm">Qualität (mm)</Label>
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
                <Label className="text-sm">Infill % (leer = Standard)</Label>
                <Input type="number" min={5} max={100} value={infill} onChange={(e) => setInfill(e.target.value)} className="bg-input border-border text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Wände (leer = Standard)</Label>
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

            {result && (
              <div className="border-t border-border pt-4 space-y-2 text-sm">
                <div className="flex flex-wrap gap-x-6 gap-y-1">
                  <span><span className="text-muted-foreground">Druckzeit:</span> {result.stats?.print_time_human ?? "–"}</span>
                  <span><span className="text-muted-foreground">Filament:</span> {result.stats?.filament_g != null ? `${result.stats.filament_g} g` : "–"}</span>
                  <span><span className="text-muted-foreground">Schichten:</span> {result.stats?.layers ?? "–"}</span>
                  <span><span className="text-muted-foreground">Slice-Dauer:</span> {result.slice_seconds != null ? `${result.slice_seconds} s` : "–"}</span>
                </div>
                <p className="text-xs text-muted-foreground break-all">Auftrag: {result.job_id}</p>
                <Button type="button" variant="outline" onClick={() => downloadGcode(result)} className="gap-2">
                  <Download className="w-4 h-4" /> G-Code herunterladen
                </Button>
              </div>
            )}
          </form>

          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <h2 className="font-semibold">2. Kalkulation</h2>
            <p className="text-xs text-muted-foreground">
              Gewicht und Druckzeit werden nach dem Slicen automatisch eingetragen. Du kannst sie von Hand ändern.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {numField("Gewicht", gewicht, setGewicht, 0.1, "g")}
              {numField("Druckzeit", druckzeit, setDruckzeit, 0.01, "h")}
              {numField("Nachbearbeitung", nachbearbeitung, setNachbearbeitung, 0.1, "h")}
              {numField("Konstruktion", konstruktion, setKonstruktion, 0.1, "h")}
              {numField("Menge", menge, setMenge, 1, "Stk.")}
            </div>
            <Button variant="outline" onClick={reset} className="gap-2 border-border">
              <RotateCcw className="w-4 h-4" /> Zurücksetzen
            </Button>
          </div>
        </div>

        {/* Ergebnis */}
        <div className="bg-card border border-border rounded-lg p-5 self-start">
          <h2 className="font-semibold mb-4">Live-Ergebnis</h2>
          <div className="space-y-2 text-sm">
            <ResultRow label="Setup" value={formatCHF(settings.setup_pauschale)} />
            <ResultRow label="Material" value={formatCHF(gewicht * settings.material_verkauf_pro_g)} />
            <ResultRow label="Maschinenzeit" value={formatCHF(druckzeit * settings.maschinenzeit_pro_h)} />
            <ResultRow label="Nachbearbeitung" value={formatCHF(nachbearbeitung * settings.nachbearbeitung_pro_h)} />
            <ResultRow label="Konstruktion" value={formatCHF(konstruktion * settings.konstruktion_pro_h)} />
            <div className="border-t border-border my-3" />
            <ResultRow label="Preis pro Stück" value={formatCHF(preisPro)} bold highlight />
            <ResultRow label={`Preis Total (×${menge})`} value={formatCHF(preisTotal)} bold />
            <div className="border-t border-border my-3" />
            <ResultRow label="Meine Kosten" value={formatCHF(kosten)} muted />
            <ResultRow label="Gewinn" value={formatCHF(gewinn)} success />
            <ResultRow label="Marge" value={formatPct(marge)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultRow({ label, value, bold, highlight, muted, success }: {
  label: string; value: string; bold?: boolean; highlight?: boolean; muted?: boolean; success?: boolean;
}) {
  return (
    <div className={`flex justify-between items-center py-0.5 ${bold ? "font-semibold" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${highlight ? "text-primary text-base" : success ? "text-success" : muted ? "text-destructive" : ""}`}>
        {value}
      </span>
    </div>
  );
}
