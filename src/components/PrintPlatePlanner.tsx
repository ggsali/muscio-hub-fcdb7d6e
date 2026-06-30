import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Layers, Download, Plus, Trash2, Loader2, AlertCircle } from "lucide-react";

interface Part {
  id: string;
  teilname: string;
  laenge_mm?: number | null;
  breite_mm?: number | null;
}

interface Printer {
  id: string;
  name: string;
  bauplatte_breite_mm: number | null;
  bauplatte_tiefe_mm: number | null;
}

interface Plate {
  id: string;
  name: string;
  equipment_id: string | null;
  status: string;
  zip_path: string | null;
  created_at: string;
}

interface PlatePart {
  id: string;
  plate_id: string;
  part_id: string;
  menge: number;
  pos_x_mm: number | null;
  pos_y_mm: number | null;
}

interface Placement {
  partId: string;
  copy: number;
  x: number;
  y: number;
  w: number;
  h: number;
  fits: boolean;
}

// Simple shelf-bin-packing (no rotation)
function packShelf(
  items: { partId: string; w: number; h: number; copies: number }[],
  plateW: number,
  plateH: number,
  gap = 5,
): { placements: Placement[]; unplaced: Placement[] } {
  const placements: Placement[] = [];
  const unplaced: Placement[] = [];
  // sort by height desc
  const expanded = items.flatMap((it) =>
    Array.from({ length: it.copies }, (_, i) => ({ ...it, copy: i + 1 })),
  );
  expanded.sort((a, b) => b.h - a.h);
  let cursorX = gap;
  let cursorY = gap;
  let shelfHeight = 0;
  for (const it of expanded) {
    if (it.w > plateW - gap * 2 || it.h > plateH - gap * 2) {
      unplaced.push({ partId: it.partId, copy: it.copy, x: 0, y: 0, w: it.w, h: it.h, fits: false });
      continue;
    }
    if (cursorX + it.w + gap > plateW) {
      // new shelf
      cursorY += shelfHeight + gap;
      cursorX = gap;
      shelfHeight = 0;
    }
    if (cursorY + it.h + gap > plateH) {
      unplaced.push({ partId: it.partId, copy: it.copy, x: 0, y: 0, w: it.w, h: it.h, fits: false });
      continue;
    }
    placements.push({ partId: it.partId, copy: it.copy, x: cursorX, y: cursorY, w: it.w, h: it.h, fits: true });
    cursorX += it.w + gap;
    if (it.h > shelfHeight) shelfHeight = it.h;
  }
  return { placements, unplaced };
}

export default function PrintPlatePlanner({ orderId, parts }: { orderId: string; parts: Part[] }) {
  const { toast } = useToast();
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [plates, setPlates] = useState<Plate[]>([]);
  const [platePartsMap, setPlatePartsMap] = useState<Record<string, PlatePart[]>>({});
  const [creating, setCreating] = useState(false);
  const [zipping, setZipping] = useState<string | null>(null);
  const [activePlateId, setActivePlateId] = useState<string | null>(null);
  const [draftPartsCount, setDraftPartsCount] = useState<Record<string, number>>({});
  const [draftPrinterId, setDraftPrinterId] = useState<string>("");
  const [draftName, setDraftName] = useState("Druckplatte 1");

  const load = async () => {
    const [{ data: eq }, { data: pl }] = await Promise.all([
      supabase.from("equipment").select("id, name, bauplatte_breite_mm, bauplatte_tiefe_mm").eq("ist_drucker", true),
      supabase.from("print_plates").select("*").eq("order_id", orderId).order("created_at", { ascending: false }),
    ]);
    setPrinters((eq as any) || []);
    setPlates((pl as any) || []);
    if (pl && pl.length) {
      const { data: pp } = await supabase
        .from("print_plate_parts").select("*").in("plate_id", pl.map((p: any) => p.id));
      const map: Record<string, PlatePart[]> = {};
      for (const r of (pp as any) || []) (map[r.plate_id] ||= []).push(r);
      setPlatePartsMap(map);
    }
  };

  useEffect(() => { load(); }, [orderId]);

  useEffect(() => {
    if (printers.length && !draftPrinterId) setDraftPrinterId(printers[0].id);
  }, [printers]);

  useEffect(() => {
    setDraftName(`Druckplatte ${plates.length + 1}`);
  }, [plates.length]);

  const eligibleParts = parts.filter(p => p.id && p.laenge_mm && p.breite_mm);
  const selectedPrinter = printers.find(p => p.id === draftPrinterId);
  const plateW = selectedPrinter?.bauplatte_breite_mm || 0;
  const plateH = selectedPrinter?.bauplatte_tiefe_mm || 0;

  const items = Object.entries(draftPartsCount)
    .filter(([_, c]) => c > 0)
    .map(([partId, copies]) => {
      const part = parts.find(p => p.id === partId);
      return { partId, w: part?.laenge_mm || 0, h: part?.breite_mm || 0, copies };
    });

  const { placements, unplaced } = plateW && plateH
    ? packShelf(items, plateW, plateH)
    : { placements: [], unplaced: [] };

  const handleSavePlate = async () => {
    if (!draftPrinterId || items.length === 0) {
      toast({ title: "Bitte Drucker und mindestens ein Teil wählen", variant: "destructive" });
      return;
    }
    setCreating(true);
    const { data: plate, error } = await supabase.from("print_plates").insert({
      order_id: orderId, equipment_id: draftPrinterId, name: draftName, status: "geplant",
    }).select().single();
    if (error || !plate) {
      toast({ title: "Fehler", description: error?.message, variant: "destructive" });
      setCreating(false);
      return;
    }
    const rows = placements.reduce((acc: any[], p) => {
      const ex = acc.find(r => r.part_id === p.partId);
      if (ex) ex.menge += 1; else acc.push({ plate_id: plate.id, part_id: p.partId, menge: 1, pos_x_mm: p.x, pos_y_mm: p.y });
      return acc;
    }, []);
    if (rows.length) await supabase.from("print_plate_parts").insert(rows);
    setDraftPartsCount({});
    setActivePlateId(plate.id);
    await load();
    setCreating(false);
    toast({ title: "Druckplatte gespeichert ✓" });
  };

  const handleGenerateZip = async (plateId: string) => {
    setZipping(plateId);
    const { data, error } = await supabase.functions.invoke("generate-plate-zip", { body: { plateId } });
    setZipping(null);
    if (error || data?.error) {
      toast({ title: "ZIP-Fehler", description: data?.error || error?.message, variant: "destructive" });
      return;
    }
    if (data?.url) window.open(data.url, "_blank");
    await load();
    toast({ title: "ZIP erstellt ✓", description: `${data?.fileCount} Dateien` });
  };

  const handleDownloadExisting = async (zipPath: string) => {
    const { data } = await supabase.storage.from("print-plates").createSignedUrl(zipPath, 60 * 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const handleDeletePlate = async (plateId: string) => {
    if (!confirm("Druckplatte wirklich löschen?")) return;
    const plate = plates.find(p => p.id === plateId);
    if (plate?.zip_path) await supabase.storage.from("print-plates").remove([plate.zip_path]);
    await supabase.from("print_plates").delete().eq("id", plateId);
    await load();
  };

  // SVG preview scale
  const previewW = 320;
  const scale = plateW ? previewW / plateW : 1;
  const previewH = plateH ? plateH * scale : 200;

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Neue Druckplatte planen</h3>
        </div>

        {printers.length === 0 ? (
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            Keine 3D-Drucker in der Maschinen-Verwaltung als Drucker markiert.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Drucker</Label>
                <select
                  value={draftPrinterId}
                  onChange={e => setDraftPrinterId(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {printers.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.bauplatte_breite_mm}×{p.bauplatte_tiefe_mm} mm)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Name</Label>
                <Input value={draftName} onChange={e => setDraftName(e.target.value)} className="h-9" />
              </div>
            </div>

            {eligibleParts.length === 0 ? (
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                Keine Teile mit STL-Maßen verfügbar. Bitte zuerst eine STL-Datei hochladen.
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Teile auswählen (Anzahl Kopien)</Label>
                  {eligibleParts.map(p => (
                    <div key={p.id} className="flex items-center gap-2 text-xs bg-muted/30 rounded px-2 py-1.5">
                      <span className="flex-1 truncate">{p.teilname}</span>
                      <span className="text-muted-foreground">{p.laenge_mm}×{p.breite_mm} mm</span>
                      <Input
                        type="number"
                        min={0}
                        value={draftPartsCount[p.id] || 0}
                        onChange={e => setDraftPartsCount(prev => ({ ...prev, [p.id]: parseInt(e.target.value) || 0 }))}
                        className="h-7 w-16 text-xs"
                      />
                    </div>
                  ))}
                </div>

                {plateW > 0 && items.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">
                      Belegt: {placements.length} / {placements.length + unplaced.length} Teile
                      {unplaced.length > 0 && <span className="text-destructive ml-2">({unplaced.length} passen nicht)</span>}
                    </div>
                    <div className="border border-border rounded bg-muted/20 inline-block">
                      <svg width={previewW} height={previewH} className="block">
                        <rect x={0} y={0} width={previewW} height={previewH} fill="hsl(var(--muted))" opacity={0.3} />
                        {placements.map((p, i) => (
                          <g key={i}>
                            <rect
                              x={p.x * scale} y={p.y * scale}
                              width={p.w * scale} height={p.h * scale}
                              fill="hsl(var(--primary))" opacity={0.4}
                              stroke="hsl(var(--primary))" strokeWidth={1}
                            />
                          </g>
                        ))}
                      </svg>
                    </div>
                  </div>
                )}

                <Button onClick={handleSavePlate} disabled={creating || items.length === 0} size="sm">
                  {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Druckplatte speichern
                </Button>
              </>
            )}
          </>
        )}
      </div>

      {plates.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-sm">Gespeicherte Druckplatten ({plates.length})</h3>
          {plates.map(plate => {
            const pp = platePartsMap[plate.id] || [];
            const printer = printers.find(p => p.id === plate.equipment_id);
            return (
              <div key={plate.id} className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{plate.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted uppercase">{plate.status}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {printer?.name || "—"} · {pp.reduce((s, r) => s + r.menge, 0)} Teile
                  </p>
                </div>
                {plate.zip_path && (
                  <Button size="sm" variant="outline" onClick={() => handleDownloadExisting(plate.zip_path!)}>
                    <Download className="w-3.5 h-3.5" /> ZIP
                  </Button>
                )}
                <Button size="sm" onClick={() => handleGenerateZip(plate.id)} disabled={zipping === plate.id}>
                  {zipping === plate.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  {plate.zip_path ? "Neu" : "Erstellen"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleDeletePlate(plate.id)}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
