import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { FilamentType } from "@/lib/filamentLager";

export default function FilamentTypeForm({
  onSaved,
  onCancel,
}: {
  onSaved: (t: FilamentType) => void;
  onCancel: () => void;
}) {
  const [material, setMaterial] = useState("PLA");
  const [farbe, setFarbe] = useState("");
  const [hersteller, setHersteller] = useState("");
  const [farbcode, setFarbcode] = useState("#e8443a");
  const [mindestbestand, setMindestbestand] = useState(1);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!material.trim() || !farbe.trim()) {
      toast.error("Material und Farbe sind Pflichtfelder");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("filament_types")
      .insert({
        material: material.trim(),
        farbe: farbe.trim(),
        hersteller: hersteller.trim() || null,
        farbcode,
        mindestbestand: Math.max(0, Number(mindestbestand) || 0),
      })
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast.error("Speichern fehlgeschlagen: " + error.message);
      return;
    }
    toast.success(`Filamentart "${material} ${farbe}" angelegt`);
    onSaved(data as FilamentType);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Material</Label>
          <Input value={material} onChange={e => setMaterial(e.target.value)} placeholder="PLA, PETG, TPU …" className="bg-input border-border" />
        </div>
        <div className="space-y-1.5">
          <Label>Farbe</Label>
          <Input value={farbe} onChange={e => setFarbe(e.target.value)} placeholder="Rot" className="bg-input border-border" />
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
        <div className="space-y-1.5">
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
      <div className="flex gap-2">
        <Button onClick={save} disabled={saving}>{saving ? "Speichert…" : "Speichern"}</Button>
        <Button variant="outline" onClick={onCancel}>Abbrechen</Button>
      </div>
    </div>
  );
}
