import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import type { FilamentType } from "@/lib/filamentLager";

export default function FilamentTypeEditDialog({
  type,
  open,
  onOpenChange,
  onSaved,
}: {
  type: FilamentType | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: (t: FilamentType) => void;
}) {
  const [material, setMaterial] = useState("");
  const [farbe, setFarbe] = useState("");
  const [hersteller, setHersteller] = useState("");
  const [farbcode, setFarbcode] = useState("#888888");
  const [mindestbestand, setMindestbestand] = useState(1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!type) return;
    setMaterial(type.material);
    setFarbe(type.farbe);
    setHersteller(type.hersteller || "");
    setFarbcode(type.farbcode || "#888888");
    setMindestbestand(type.mindestbestand);
  }, [type]);

  const save = async () => {
    if (!type) return;
    if (!material.trim() || !farbe.trim()) {
      toast.error("Material und Farbe sind Pflichtfelder");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("filament_types")
      .update({
        material: material.trim(),
        farbe: farbe.trim(),
        hersteller: hersteller.trim() || null,
        farbcode,
        mindestbestand: Math.max(0, Number(mindestbestand) || 0),
      })
      .eq("id", type.id)
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast.error("Speichern fehlgeschlagen: " + error.message);
      return;
    }
    toast.success("Filamentart aktualisiert");
    onSaved(data as FilamentType);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Filamentart bearbeiten</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Material</Label>
            <Input value={material} onChange={e => setMaterial(e.target.value)} className="bg-input border-border" />
          </div>
          <div className="space-y-1.5">
            <Label>Farbe</Label>
            <Input value={farbe} onChange={e => setFarbe(e.target.value)} className="bg-input border-border" />
          </div>
          <div className="space-y-1.5">
            <Label>Hersteller</Label>
            <Input value={hersteller} onChange={e => setHersteller(e.target.value)} placeholder="optional" className="bg-input border-border" />
          </div>
          <div className="space-y-1.5">
            <Label>Mindestbestand</Label>
            <Input
              type="number"
              min={0}
              value={mindestbestand}
              onChange={e => setMindestbestand(parseInt(e.target.value) || 0)}
              className="bg-input border-border"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Farbe fürs Etikett</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={farbcode}
                onChange={e => setFarbcode(e.target.value)}
                className="h-10 w-14 rounded-md border border-border bg-input cursor-pointer"
                aria-label="Farbwahl"
              />
              <Input value={farbcode} onChange={e => setFarbcode(e.target.value)} className="bg-input border-border" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Speichert…" : "Speichern"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
