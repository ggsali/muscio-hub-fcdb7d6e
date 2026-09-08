import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { ScanLine, CheckCircle2, XCircle } from "lucide-react";

type Result = { ok: boolean; text: string; code: string };

export default function FilamentScanPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[]>([]);

  const focus = () => inputRef.current?.focus();
  useEffect(() => {
    focus();
    const iv = setInterval(focus, 1500);
    return () => clearInterval(iv);
  }, []);

  const handle = async (raw: string) => {
    const code = raw.trim();
    if (!code) return;
    setBusy(true);
    try {
      const { data: spool, error } = await supabase
        .from("filament_spools")
        .select("id, spool_code, status, filament_type_id")
        .eq("spool_code", code)
        .maybeSingle();
      if (error) throw error;
      if (!spool) {
        setResults(r => [{ ok: false, text: "Code unbekannt", code }, ...r].slice(0, 15));
        return;
      }
      if ((spool as any).status === "leer") {
        setResults(r => [{ ok: false, text: "Rolle war bereits leer gemeldet", code }, ...r].slice(0, 15));
        return;
      }
      const { data: typ } = await supabase
        .from("filament_types")
        .select("material, farbe")
        .eq("id", (spool as any).filament_type_id)
        .maybeSingle();
      const { error: upErr } = await supabase
        .from("filament_spools")
        .update({ status: "leer", emptied_at: new Date().toISOString() })
        .eq("id", (spool as any).id);
      if (upErr) throw upErr;
      const label = typ ? `${(typ as any).material} · ${(typ as any).farbe}` : "Rolle";
      setResults(r => [{ ok: true, text: `${label} – als leer gemeldet`, code }, ...r].slice(0, 15));
    } catch (e: any) {
      setResults(r => [{ ok: false, text: "Fehler: " + e.message, code }, ...r].slice(0, 15));
    } finally {
      setBusy(false);
      setValue("");
      focus();
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl md:text-2xl font-bold">Rolle leer melden</h1>
        <p className="text-sm text-muted-foreground">Etikett scannen – der Code wird automatisch übernommen</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ScanLine className="w-4 h-4" /> Scanner bereit {busy && "· verarbeite…"}
        </div>
        <Input
          ref={inputRef}
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          onBlur={() => setTimeout(focus, 50)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handle(value); } }}
          placeholder="FIL-0001"
          className="h-16 text-2xl font-mono text-center bg-input border-border"
        />
      </div>

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((r, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
                r.ok ? "border-success/40 bg-success/10 text-success" : "border-destructive/40 bg-destructive/10 text-destructive"
              }`}
            >
              {r.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              <span className="font-mono">{r.code}</span>
              <span className="text-foreground/80">{r.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
