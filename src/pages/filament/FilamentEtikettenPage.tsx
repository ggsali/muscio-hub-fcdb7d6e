import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Printer, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { QRCodeCanvas } from "qrcode.react";
import { loadTypes, loadSpools, typeLabel, type FilamentSpool, type FilamentType } from "@/lib/filamentLager";

export default function FilamentEtikettenPage() {
  const [spools, setSpools] = useState<FilamentSpool[]>([]);
  const [types, setTypes] = useState<FilamentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [selectedSpools, setSelectedSpools] = useState<Set<string>>(new Set());

  const load = async () => {
    try {
      const [t, s] = await Promise.all([loadTypes(), loadSpools()]);
      setTypes(t);
      const unprinted = s.filter(x => !x.printed);
      setSpools(unprinted);
      setSelectedSpools(new Set(unprinted.map(s => s.id)));
    } catch (e: any) {
      toast.error("Laden fehlgeschlagen: " + e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const typeMap = useMemo(() => Object.fromEntries(types.map(t => [t.id, t])), [types]);

  const sorted = useMemo(() => {
    return [...spools].sort((a, b) => {
      const la = typeMap[a.filament_type_id] ? typeLabel(typeMap[a.filament_type_id]) : "";
      const lb = typeMap[b.filament_type_id] ? typeLabel(typeMap[b.filament_type_id]) : "";
      return la.localeCompare(lb) || a.spool_code.localeCompare(b.spool_code);
    });
  }, [spools, typeMap]);

  const toggleSpool = (id: string) => {
    setSelectedSpools(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedSpools(new Set(sorted.map(s => s.id)));
  const selectNone = () => setSelectedSpools(new Set());

  const handleDrucken = () => {
    if (selectedSpools.size === 0) {
      toast.error("Keine Rollen ausgewählt");
      return;
    }

    const selected = sorted.filter(s => selectedSpools.has(s.id));

    const etikettenHtml = selected.map(spool => {
      const t = typeMap[spool.filament_type_id];
      const canvas = document.querySelector(`[data-spool="${spool.id}"] canvas`) as HTMLCanvasElement | null;
      const qrDataUrl = canvas ? canvas.toDataURL() : "";

      return `
        <div class="etikett">
          ${qrDataUrl ? `<img src="${qrDataUrl}" width="91" height="91" />` : ""}
          <div class="text">
            <div class="material">${t ? t.material : "?"}</div>
            <div class="farbe">${t ? t.farbe : ""}</div>
            <div class="code">${spool.spool_code}</div>
            <div class="gewicht">${spool.gewicht_g}g</div>
          </div>
        </div>
      `;
    }).join("");

    const printWindow = window.open("", "_blank", "width=600,height=400");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Etiketten drucken</title>
        <style>
          @page { size: 50mm 30mm; margin: 0; }
          body { margin: 0; padding: 0; }
          .etikett {
            width: 50mm;
            height: 30mm;
            display: flex;
            flex-direction: row;
            align-items: center;
            padding: 1mm;
            gap: 1.5mm;
            box-sizing: border-box;
            page-break-after: always;
            break-after: page;
          }
          .etikett:last-child {
            page-break-after: avoid;
            break-after: avoid;
          }
          img { 
            display: block; 
            flex-shrink: 0;
            width: 24mm;
            height: 24mm;
          }
          .text { 
            display: flex; 
            flex-direction: column; 
            gap: 0.8mm;
            font-family: Arial, sans-serif;
          }
          .material { font-size: 10pt; font-weight: 700; color: #000; }
          .farbe { font-size: 8.5pt; color: #333; }
          .code { font-size: 9pt; font-weight: 700; color: #00a651; font-family: monospace; }
          .gewicht { font-size: 7pt; color: #888; }
        </style>
      </head>
      <body>
        ${etikettenHtml}
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  const handleBedruckt = async () => {
    if (selectedSpools.size === 0) {
      toast.error("Keine Rollen ausgewählt");
      return;
    }
    setWorking(true);
    const { error } = await supabase
      .from("filament_spools")
      .update({ printed: true })
      .in("id", Array.from(selectedSpools));
    setWorking(false);
    if (error) { toast.error("Fehlgeschlagen: " + error.message); return; }
    toast.success("Ausgewählte Etiketten als bedruckt markiert ✓");
    setSelectedSpools(new Set());
    await load();
  };

  const selectedCount = selectedSpools.size;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Etiketten drucken</h1>
          <p className="text-sm text-muted-foreground">Unbedruckte Rollen – 50 × 30 mm Endlospapier</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <Button onClick={handleDrucken} disabled={selectedCount === 0}>
              <Printer className="w-4 h-4 mr-1.5" /> Ausgewählte drucken ({selectedCount})
            </Button>
            <Button variant="outline" onClick={handleBedruckt} disabled={working || selectedCount === 0}>
              <CheckCheck className="w-4 h-4 mr-1.5" /> Ausgewählte als bedruckt markieren
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            💡 Tipp: Im Druckdialog unter "Weitere Einstellungen" → "Kopf- und Fusszeilen" deaktivieren
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Lädt…</p>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">Keine unbedruckten Rollen — alle Etiketten sind aktuell.</p>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {selectedCount} von {sorted.length} Rollen ausgewählt
            </p>
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="text-xs text-primary underline"
              >
                Alle auswählen
              </button>
              <button
                onClick={selectNone}
                className="text-xs text-muted-foreground underline"
              >
                Keine
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            {sorted.map(s => {
              const t = typeMap[s.filament_type_id];
              const isSelected = selectedSpools.has(s.id);
              return (
                <div
                  key={s.id}
                  onClick={() => toggleSpool(s.id)}
                  className={`relative border-2 rounded-xl p-3 cursor-pointer transition-all ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border opacity-50"
                  }`}
                >
                  <div className={`absolute top-2 left-2 w-5 h-5 rounded border-2 flex items-center justify-center ${
                    isSelected
                      ? "border-primary bg-primary"
                      : "border-border bg-background"
                  }`}>
                    {isSelected && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div className="ml-6 flex items-center gap-2">
                    <div data-spool={s.id}>
                      <QRCodeCanvas value={s.spool_code} size={80} level="M" />
                    </div>
                    <div className="text-xs">
                      <p className="font-bold">{t ? t.material : "?"}</p>
                      <p className="text-muted-foreground">{t ? t.farbe : ""}</p>
                      <p className="text-primary font-mono font-bold">{s.spool_code}</p>
                      <p className="text-muted-foreground">{s.gewicht_g}g</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
