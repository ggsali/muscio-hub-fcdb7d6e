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
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #etiketten-druck, #etiketten-druck * { visibility: visible !important; }
          #etiketten-druck { position: absolute; left: 0; top: 0; width: 50mm; }
          .fil-label { page-break-after: always; break-after: page; border: none !important; }
        }
        @page { size: 50mm 30mm; margin: 0; }
      `}</style>

      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Etiketten drucken</h1>
          <p className="text-sm text-muted-foreground">Unbedruckte Rollen – 50 × 30 mm Endlospapier</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => window.print()} disabled={sorted.length === 0}>
            <Printer className="w-4 h-4 mr-1.5" /> Etiketten drucken
          </Button>
          <Button variant="outline" onClick={markPrinted} disabled={working || sorted.length === 0}>
            <CheckCheck className="w-4 h-4 mr-1.5" /> Alle als bedruckt markieren
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground print:hidden">Lädt…</p>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground print:hidden">Keine unbedruckten Rollen — alle Etiketten sind aktuell.</p>
      ) : (
        <div id="etiketten-druck" className="flex flex-wrap gap-4 print:block print:gap-0">
          {sorted.map(s => {
            const t = typeMap[s.filament_type_id];
            return (
              <div
                key={s.id}
                className="fil-label border border-border rounded-md bg-white text-black flex items-center gap-2 p-2 overflow-hidden"
                style={{ width: "50mm", height: "30mm" }}
              >
                <QRCodeSVG value={s.spool_code} size={80} level="M" style={{ width: "22mm", height: "22mm" }} />
                <div className="min-w-0 leading-tight">
                  <p className="text-[10px] font-bold truncate">{t ? t.material : "?"}</p>
                  <p className="text-[10px] truncate">{t ? t.farbe : ""}</p>
                  <p className="text-[10px] font-mono">{s.spool_code}</p>
                  <p className="text-[8px]">{s.gewicht_g} g</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
