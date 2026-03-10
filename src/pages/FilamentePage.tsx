import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Save, X, Pencil } from "lucide-react";

export interface Filament {
  id: string;
  name: string;
  material: string;
  farbe: string;
  hersteller: string;
  preis_pro_kg: number;
  dichte_g_cm3: number;
  verkaufspreis_pro_g: number | null;
  notizen: string;
  aktiv: boolean;
}

const MATERIAL_OPTIONS = ["PLA", "PLA+", "PETG", "TPU", "ABS", "ASA", "Nylon", "PC", "HIPS", "Sonstige"];

const emptyFilament = (): Omit<Filament, "id"> => ({
  name: "",
  material: "PLA",
  farbe: "",
  hersteller: "",
  preis_pro_kg: 25,
  dichte_g_cm3: 1.24,
  notizen: "",
  aktiv: true,
});

export default function FilamentePage() {
  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<(Partial<Filament> & { isNew?: boolean }) | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("filaments").select("*").order("material").order("name");
    if (data) setFilaments(data as Filament[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    if (editing.id) {
      const { isNew, ...data } = editing as any;
      await supabase.from("filaments").update(data).eq("id", editing.id);
    } else {
      const { isNew, id, ...data } = editing as any;
      await supabase.from("filaments").insert([data]);
    }
    await load();
    setEditing(null);
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("filaments").delete().eq("id", id);
    await load();
  };

  const toggleAktiv = async (f: Filament) => {
    await supabase.from("filaments").update({ aktiv: !f.aktiv }).eq("id", f.id);
    await load();
  };

  const grouped = MATERIAL_OPTIONS.reduce((acc, mat) => {
    const items = filaments.filter(f => f.material === mat);
    if (items.length) acc[mat] = items;
    return acc;
  }, {} as Record<string, Filament[]>);
  const sonstige = filaments.filter(f => !MATERIAL_OPTIONS.includes(f.material));
  if (sonstige.length) grouped["Sonstige"] = sonstige;

  return (
    <div className="p-6 animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Filament-Bibliothek</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{filaments.length} Filamente hinterlegt</p>
        </div>
        <Button onClick={() => setEditing({ ...emptyFilament(), isNew: true })} className="bg-primary hover:bg-primary/90 gap-2">
          <Plus className="w-4 h-4" /> Filament hinzufügen
        </Button>
      </div>

      {/* Edit / New Form */}
      {editing && (
        <div className="bg-card border border-primary/40 rounded-lg p-5 space-y-4">
          <h3 className="font-semibold text-sm">{editing.isNew ? "Neues Filament" : "Filament bearbeiten"}</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Name / Bezeichnung *</Label>
              <Input value={editing.name ?? ""} onChange={e => setEditing({ ...editing, name: e.target.value })} className="bg-input border-border h-8 text-sm" placeholder="z.B. Prusament PLA Galaxy" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Material *</Label>
              <select value={editing.material ?? "PLA"} onChange={e => setEditing({ ...editing, material: e.target.value })} className="w-full h-8 px-2 rounded-md bg-input border border-border text-sm text-foreground">
                {MATERIAL_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Farbe</Label>
              <div className="flex gap-2 items-center">
                <input type="color" value={editing.farbe || "#888888"} onChange={e => setEditing({ ...editing, farbe: e.target.value })} className="w-8 h-8 rounded border border-border cursor-pointer p-0.5 bg-transparent" />
                <Input value={editing.farbe ?? ""} onChange={e => setEditing({ ...editing, farbe: e.target.value })} className="bg-input border-border h-8 text-sm flex-1" placeholder="Blau, #1A2B3C…" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Hersteller</Label>
              <Input value={editing.hersteller ?? ""} onChange={e => setEditing({ ...editing, hersteller: e.target.value })} className="bg-input border-border h-8 text-sm" placeholder="Prusa, eSUN, Bambu…" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Preis (CHF / kg) *</Label>
              <Input type="number" step="0.5" value={editing.preis_pro_kg ?? ""} onChange={e => setEditing({ ...editing, preis_pro_kg: parseFloat(e.target.value) || 0 })} className="bg-input border-border h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Dichte (g/cm³)</Label>
              <Input type="number" step="0.01" value={editing.dichte_g_cm3 ?? ""} onChange={e => setEditing({ ...editing, dichte_g_cm3: parseFloat(e.target.value) || 1.24 })} className="bg-input border-border h-8 text-sm" />
            </div>
            <div className="col-span-2 md:col-span-3 space-y-1.5">
              <Label className="text-xs">Notizen</Label>
              <Input value={editing.notizen ?? ""} onChange={e => setEditing({ ...editing, notizen: e.target.value })} className="bg-input border-border h-8 text-sm" placeholder="Besonderheiten, Drucktemperatur…" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving || !editing.name} className="bg-primary hover:bg-primary/90 gap-2">
              <Save className="w-4 h-4" />{saving ? "Speichern..." : "Speichern"}
            </Button>
            <Button variant="outline" onClick={() => setEditing(null)} className="border-border gap-1.5"><X className="w-4 h-4" />Abbrechen</Button>
          </div>
        </div>
      )}

      {/* Filament list grouped by material */}
      {loading ? (
        <div className="text-muted-foreground text-sm">Laden...</div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-10 text-center text-muted-foreground text-sm">
          Noch keine Filamente. Füge dein erstes Filament hinzu.
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([mat, items]) => (
            <div key={mat}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{mat}</h3>
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-2.5 text-left text-muted-foreground font-medium text-xs">Name</th>
                      <th className="px-4 py-2.5 text-left text-muted-foreground font-medium text-xs">Farbe</th>
                      <th className="px-4 py-2.5 text-left text-muted-foreground font-medium text-xs">Hersteller</th>
                      <th className="px-4 py-2.5 text-right text-muted-foreground font-medium text-xs">CHF / kg</th>
                      <th className="px-4 py-2.5 text-right text-muted-foreground font-medium text-xs">g/cm³</th>
                      <th className="px-4 py-2.5 text-left text-muted-foreground font-medium text-xs">Notizen</th>
                      <th className="px-4 py-2.5 text-center text-muted-foreground font-medium text-xs">Aktiv</th>
                      <th className="px-2 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(f => (
                      <tr key={f.id} className={`border-b border-border/50 last:border-0 hover:bg-muted/20 ${!f.aktiv ? "opacity-50" : ""}`}>
                        <td className="px-4 py-2.5 font-medium">{f.name}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            {f.farbe && <div className="w-4 h-4 rounded-full border border-border flex-shrink-0" style={{ backgroundColor: f.farbe }} />}
                            <span className="text-muted-foreground text-xs">{f.farbe || "—"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground text-xs">{f.hersteller || "—"}</td>
                        <td className="px-4 py-2.5 text-right font-medium tabular-nums text-primary">CHF {f.preis_pro_kg.toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums text-xs">{f.dichte_g_cm3}</td>
                        <td className="px-4 py-2.5 text-muted-foreground text-xs max-w-[140px] truncate">{f.notizen || "—"}</td>
                        <td className="px-4 py-2.5 text-center">
                          <button onClick={() => toggleAktiv(f)} className={`w-4 h-4 rounded-full border ${f.aktiv ? "bg-success border-success" : "border-muted-foreground"}`} />
                        </td>
                        <td className="px-2 py-2.5">
                          <div className="flex gap-1">
                            <button onClick={() => setEditing({ ...f })} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDelete(f.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
