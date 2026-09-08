import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Printer, CheckCheck, Truck, ScanLine, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import FilamentTypeForm from "@/components/filament/FilamentTypeForm";
import {
  loadTypes,
  nextSpoolNumber,
  formatSpoolCode,
  typeLabel,
  type FilamentSpool,
  type FilamentType,
} from "@/lib/filamentLager";

export default function FilamentLieferungPage() {
  const [types, setTypes] = useState<FilamentType[]>([]);
  const [typeId, setTypeId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [anzahl, setAnzahl] = useState(1);
  const [gewicht, setGewicht] = useState(1000);
  const [saving, setSaving] = useState(false);

  const [created, setCreated] = useState<FilamentSpool[]>([]);
  const [scanned, setScanned] = useState<string[]>([]);
  const [scanValue, setScanValue] = useState("");
  const [scanFeedback, setScanFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadTypes().then(setTypes).catch((e: any) => toast.error("Laden fehlgeschlagen: " + e.message));
  }, []);

  const selectedType = useMemo(() => types.find(t => t.id === typeId) || null, [types, typeId]);
  const activeType = useMemo(
    () => types.find(t => t.id === (created[0]?.filament_type_id || typeId)) || null,
    [types, created, typeId]
  );

  const focusScan = () => scanRef.current?.focus();
  useEffect(() => {
    if (created.length === 0) return;
    focusScan();
    const iv = setInterval(focusScan, 1500);
    return () => clearInterval(iv);
  }, [created.length]);

  const createSpools = async () => {
    if (!typeId) { toast.error("Bitte eine Filamentart wählen"); return; }
    const count = Math.max(1, Math.min(500, Number(anzahl) || 0));
    setSaving(true);
    try {
      const start = await nextSpoolNumber();
      const rows = Array.from({ length: count }, (_, i) => ({
        spool_code: formatSpoolCode(start + i),
        filament_type_id: typeId,
        gewicht_g: Math.max(1, Number(gewicht) || 1000),
        status: "voll",
        printed: false,
      }));
      const { data, error } = await supabase.from("filament_spools").insert(rows).select();
      if (error) throw error;
      setCreated((data || []) as unknown as FilamentSpool[]);
      setScanned([]);
      setScanFeedback(null);
      toast.success(
        count === 1
          ? `Rolle ${rows[0].spool_code} eingebucht`
          : `${count} Rollen eingebucht: ${rows[0].spool_code} – ${rows[rows.length - 1].spool_code}`
      );
    } catch (e: any) {
      toast.error("Einbuchen fehlgeschlagen: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const markPrinted = async () => {
    if (created.length === 0) return;
    const { error } = await supabase
      .from("filament_spools")
      .update({ printed: true })
      .in("id", created.map(s => s.id));
    if (error) { toast.error("Fehlgeschlagen: " + error.message); return; }
    setCreated(prev => prev.map(s => ({ ...s, printed: true })));
    toast.success(`${created.length} Etikett(en) als bedruckt markiert`);
  };

  const handleScan = async (raw: string) => {
    const code = raw.trim();
    setScanValue("");
    if (!code) return;
    try {
      const { data: spool, error } = await supabase
        .from("filament_spools")
        .select("id, spool_code")
        .eq("spool_code", code)
        .maybeSingle();
      if (error) throw error;
      if (!spool) {
        setScanFeedback({ ok: false, text: `${code} – Code nicht gefunden – bitte neu erstellen` });
        toast.error("Code nicht gefunden");
        return;
      }
      const { error: upErr } = await supabase
        .from("filament_spools")
        .update({ eingelagert: true, eingelagert_at: new Date().toISOString() } as any)
        .eq("id", (spool as any).id);
      if (upErr) throw upErr;
      setScanned(prev => (prev.includes(code) ? prev : [...prev, code]));
      setScanFeedback({ ok: true, text: `${code} eingelagert` });
    } catch (e: any) {
      setScanFeedback({ ok: false, text: "Fehler: " + e.message });
    } finally {
      focusScan();
    }
  };

  const eingelagertCount = created.filter(s => scanned.includes(s.spool_code)).length;
  const alleFertig = created.length > 0 && eingelagertCount === created.length;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl">
      <style>{`
        @media print {
          @page { size: 50mm 30mm; margin: 0; }
          body * { visibility: hidden; }
          .etiketten-druck-container,
          .etiketten-druck-container * { visibility: visible; }
          .etiketten-druck-container { position: fixed; top: 0; left: 0; }
          .etikett-print { page-break-after: always; break-after: page; }
        }
      `}</style>

      <div className="print:hidden">
        <h1 className="text-xl md:text-2xl font-bold">Lieferung einbuchen</h1>
        <p className="text-sm text-muted-foreground">
          Neue Lieferung erfassen, Etiketten drucken und Rollen per Scan einlagern
        </p>
      </div>

      {/* Schritt 1 */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-4 print:hidden">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Truck className="w-4 h-4 text-primary" /> 1. Lieferung erfassen
        </div>

        <div className="space-y-1.5">
          <Label>Filamentart</Label>
          <div className="flex items-center gap-2">
            {selectedType && (
              <span
                className="h-6 w-6 rounded-full border border-border shrink-0"
                style={{ background: selectedType.farbcode || "#999" }}
              />
            )}
            <select
              value={typeId}
              onChange={e => {
                if (e.target.value === "__new__") { setShowForm(true); return; }
                setTypeId(e.target.value);
              }}
              className="w-full h-10 rounded-md border border-border bg-input px-3 text-sm"
            >
              <option value="">– bitte wählen –</option>
              {types.map(t => (
                <option key={t.id} value={t.id}>
                  {typeLabel(t)}{t.hersteller ? ` (${t.hersteller})` : ""}
                </option>
              ))}
              <option value="__new__">+ Neue Filamentart anlegen…</option>
            </select>
          </div>
        </div>

        {showForm && (
          <FilamentTypeForm
            onSaved={t => { setTypes(prev => [...prev, t]); setTypeId(t.id); setShowForm(false); }}
            onCancel={() => setShowForm(false)}
          />
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Anzahl Rollen</Label>
            <Input type="number" min={1} value={anzahl} onChange={e => setAnzahl(parseInt(e.target.value) || 1)} className="bg-input border-border" />
          </div>
          <div className="space-y-1.5">
            <Label>Gewicht pro Rolle (g)</Label>
            <Input type="number" min={1} value={gewicht} onChange={e => setGewicht(parseInt(e.target.value) || 1000)} className="bg-input border-border" />
          </div>
        </div>

        <Button onClick={createSpools} disabled={saving}>
          <Printer className="w-4 h-4 mr-1.5" /> {saving ? "Erstellt…" : "Etiketten erstellen & drucken"}
        </Button>
      </div>

      {/* Schritt 2 */}
      {created.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div className="text-sm font-medium">2. Etiketten ({created.length})</div>
            <div className="flex gap-2">
              <Button onClick={() => window.print()}>
                <Printer className="w-4 h-4 mr-1.5" /> Drucken
              </Button>
              <Button variant="outline" onClick={markPrinted}>
                <CheckCheck className="w-4 h-4 mr-1.5" /> Als bedruckt markieren
              </Button>
            </div>
          </div>

          <div className="etiketten-druck-container flex flex-wrap gap-4 print:block print:gap-0">
            {created.map(s => (
              <div
                key={s.id}
                className="etikett-print bg-white text-black flex items-center overflow-hidden"
                style={{ width: "50mm", height: "30mm" }}
              >
                <div className="flex items-center justify-center" style={{ width: "30mm", height: "30mm", flexShrink: 0 }}>
                  <QRCodeSVG value={s.spool_code} size={110} level="M" style={{ width: "28mm", height: "28mm" }} />
                </div>
                <div
                  className="leading-tight flex flex-col justify-center min-w-0"
                  style={{ width: "20mm", height: "30mm", paddingRight: "1mm" }}
                >
                  <p className="text-[9px] font-bold truncate">{activeType ? activeType.material : "?"}</p>
                  <p className="text-[9px] truncate">{activeType ? activeType.farbe : ""}</p>
                  <p className="text-[8px] font-mono truncate">{s.spool_code}</p>
                  <p className="text-[7px]">{s.gewicht_g}g</p>
                </div>
              </div>
            ))}
          </div>

          {/* Schritt 3 */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3 print:hidden">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ScanLine className="w-4 h-4 text-primary" /> 3. Einlagern per Scan
            </div>
            <p className="text-sm text-muted-foreground">Etiketten aufkleben und Rollen scannen zum Einlagern…</p>
            <Input
              ref={scanRef}
              value={scanValue}
              onChange={e => setScanValue(e.target.value)}
              onBlur={() => setTimeout(focusScan, 50)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleScan(scanValue); } }}
              placeholder="FIL-0001"
              className="h-16 text-2xl font-mono text-center bg-input border-border"
            />

            <div className="text-sm font-medium">
              {eingelagertCount} / {created.length} Rollen eingelagert
            </div>

            {scanFeedback && (
              <div
                className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
                  scanFeedback.ok
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-destructive/40 bg-destructive/10 text-destructive"
                }`}
              >
                {scanFeedback.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                <span>{scanFeedback.text}</span>
              </div>
            )}

            {alleFertig && (
              <div className="rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm text-primary font-medium">
                ✓ Alle {created.length} Rollen erfolgreich eingelagert!
              </div>
            )}

            <ul className="grid gap-1.5 sm:grid-cols-2">
              {created.map(s => {
                const done = scanned.includes(s.spool_code);
                return (
                  <li
                    key={s.id}
                    className={`flex items-center gap-2 rounded-lg border p-2 text-sm font-mono ${
                      done ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground"
                    }`}
                  >
                    {done ? <CheckCircle2 className="w-4 h-4" /> : <span className="w-4 h-4 rounded-full border border-border" />}
                    {s.spool_code}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
