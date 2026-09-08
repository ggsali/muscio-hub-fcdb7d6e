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

  const load = async () => {
    try {
      const [t, s] = await Promise.all([loadTypes(), loadSpools()]);
      setTypes(t);
      setSpools(s.filter(x => !x.printed));
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

  const markPrinted = async () => {
    if (sorted.length === 0) return;
    setWorking(true);
    const { error } = await supabase
      .from("filament_spools")
      .update({ printed: true })
      .in("id", sorted.map(s => s.id));
    setWorking(false);
    if (error) { toast.error("Fehlgeschlagen: " + error.message); return; }
    toast.success(`${sorted.length} Etikett(en) als bedruckt markiert`);
    setSpools([]);
  };

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
            <Button onClick={() => window.print()} disabled={sorted.length === 0}>
              <Printer className="w-4 h-4 mr-1.5" /> Etiketten drucken
            </Button>
            <Button variant="outline" onClick={markPrinted} disabled={working || sorted.length === 0}>
              <CheckCheck className="w-4 h-4 mr-1.5" /> Alle als bedruckt markieren
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
        <div id="etiketten-print-container" className="flex flex-wrap gap-4 print:block">
          {sorted.map(s => {
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
