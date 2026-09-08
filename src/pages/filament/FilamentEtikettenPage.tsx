import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Printer, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
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
    window.print();
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
      <style dangerouslySetInnerHTML={{ __html: printStyles }} />

      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
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
        <p className="text-sm text-muted-foreground print:hidden">Lädt…</p>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground print:hidden">Keine unbedruckten Rollen — alle Etiketten sind aktuell.</p>
      ) : (
        <>
          <div className="flex items-center justify-between print:hidden">
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

          <div id="etiketten-print-container" className="hidden print:block">
            {sorted.map(s => {
              const t = typeMap[s.filament_type_id];
              const isSelected = selectedSpools.has(s.id);
              return (
                <div
                  key={s.id}
                  onClick={() => toggleSpool(s.id)}
                  className={`etikett-vorschau relative border-2 rounded-xl p-3 cursor-pointer transition-all print:hidden ${
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
                    <QRCodeSVG value={s.spool_code} size={60} level="M" />
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

            {sorted
              .filter(s => selectedSpools.has(s.id))
              .map(s => {
                const t = typeMap[s.filament_type_id];
                return (
                  <div key={s.id} className="etikett-seite">
                    <div className="etikett-qr">
                      <QRCodeSVG value={s.spool_code} size={98} level="M" />
                    </div>
                    <div className="etikett-text">
                      <div className="etikett-material">{t ? t.material : "?"}</div>
                      <div className="etikett-farbe">{t ? t.farbe : ""}</div>
                      <div className="etikett-code">{s.spool_code}</div>
                      <div className="etikett-gewicht">{s.gewicht_g}g</div>
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

const printStyles = `
  @media print {
    @page {
      size: 50mm 30mm;
      margin: 0mm;
      margin-top: 0mm;
      margin-bottom: 0mm;
    }

    html {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    html, body {
      width: 50mm;
      height: 30mm;
      margin: 0;
      padding: 0;
    }

    body * { visibility: hidden !important; }

    #etiketten-print-container,
    #etiketten-print-container * {
      visibility: visible !important;
    }

    #etiketten-print-container {
      position: fixed;
      top: 0;
      left: 0;
      width: 50mm;
    }

    .etikett-seite {
      width: 50mm;
      height: 30mm;
      page-break-after: always;
      break-after: page;
      page-break-inside: avoid;
      break-inside: avoid;
      display: flex;
      flex-direction: row;
      align-items: center;
      padding: 1.5mm;
      gap: 2mm;
      box-sizing: border-box;
      background: white;
      overflow: hidden;
      position: relative;
    }

    .etikett-seite:last-child {
      page-break-after: avoid;
      break-after: avoid;
    }

    .etikett-vorschau {
      display: none !important;
    }

    .etikett-qr {
      flex-shrink: 0;
      width: 26mm;
      height: 26mm;
    }

    .etikett-qr svg {
      width: 100% !important;
      height: 100% !important;
    }

    .etikett-text {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 0.8mm;
      font-family: Arial, sans-serif;
      overflow: hidden;
    }

    .etikett-material {
      font-size: 9pt;
      font-weight: 700;
      color: #000;
      line-height: 1.2;
    }

    .etikett-farbe {
      font-size: 8pt;
      color: #333;
      line-height: 1.2;
    }

    .etikett-code {
      font-size: 8pt;
      font-weight: 700;
      color: #00a651;
      font-family: monospace;
      line-height: 1.2;
    }

    .etikett-gewicht {
      font-size: 7pt;
      color: #888;
      line-height: 1.2;
    }
  }
`;
