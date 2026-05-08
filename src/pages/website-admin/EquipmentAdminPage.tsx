import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ModelViewer from "@/components/site/ModelViewer";
import { toast } from "sonner";

interface Spec { key: string; value: string; }
interface Rotation { x: number; y: number; z: number; px: number; py: number; pz: number }
interface Equipment {
  id: string;
  name: string;
  beschreibung: string | null;
  specs: Spec[] | null;
  modell_url: string | null;
  vorschaubild_url: string | null;
  sort_order: number;
  aktiv: boolean;
  model_rotation?: Rotation | null;
}

const empty = { name: "", beschreibung: "", specs: [] as Spec[], aktiv: true, sort_order: 0, vorschaubild_url: "", modell_url: "", model_rotation: { x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0 } as Rotation };

export default function EquipmentAdminPage() {
  const [items, setItems] = useState<Equipment[]>([]);
  const [editing, setEditing] = useState<(typeof empty & { id?: string }) | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [calibration, setCalibration] = useState<{ url: string; rotation: Rotation } | null>(null);

  const load = async () => {
    const { data } = await (supabase.from as any)("equipment").select("*").order("sort_order");
    setItems((data as Equipment[]) || []);
  };
  useEffect(() => { load(); }, []);

  const startNew = () => { setEditing({ ...empty, sort_order: items.length + 1 }); setImageFile(null); setModelFile(null); };
  const startEdit = (e: Equipment) => {
    setEditing({
      id: e.id, name: e.name, beschreibung: e.beschreibung || "",
      specs: Array.isArray(e.specs) ? e.specs : [],
      aktiv: e.aktiv, sort_order: e.sort_order,
      vorschaubild_url: e.vorschaubild_url || "", modell_url: e.modell_url || "",
      model_rotation: e.model_rotation || { x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0 },
    });
    setImageFile(null); setModelFile(null);
  };

  const upload = async (bucket: string, file: File) => {
    const path = `${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file);
    if (error) throw error;
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  };

  const save = async () => {
    if (!editing || !editing.name.trim()) return;
    setSaving(true);
    try {
      let vorschaubild_url = editing.vorschaubild_url || null;
      let modell_url = editing.modell_url || null;
      let openCalibration: string | null = null;
      if (imageFile) vorschaubild_url = await upload("equipment-images", imageFile);
      if (modelFile) {
        modell_url = await upload("equipment-models", modelFile);
        openCalibration = modell_url;
      }

      const payload = {
        name: editing.name,
        beschreibung: editing.beschreibung || null,
        specs: editing.specs.filter(s => s.key.trim()),
        vorschaubild_url, modell_url,
        sort_order: editing.sort_order,
        aktiv: editing.aktiv,
        model_rotation: editing.model_rotation,
      };
      if (editing.id) {
        await (supabase.from as any)("equipment").update(payload).eq("id", editing.id);
      } else {
        const { data } = await (supabase.from as any)("equipment").insert(payload).select().single();
        if (data) setEditing({ ...editing, id: data.id, modell_url, vorschaubild_url: vorschaubild_url || "" });
      }
      toast.success("Gespeichert");
      setModelFile(null); setImageFile(null);
      load();
      if (openCalibration) {
        setCalibration({ url: openCalibration, rotation: { x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0 } });
      } else {
        setEditing(null);
      }
    } catch (e: any) {
      toast.error(e.message || "Fehler beim Speichern");
    } finally { setSaving(false); }
  };

  const saveCalibration = async () => {
    if (!editing?.id || !calibration) return;
    await (supabase.from as any)("equipment").update({ model_rotation: calibration.rotation }).eq("id", editing.id);
    toast.success("Ausrichtung gespeichert");
    setCalibration(null);
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Wirklich löschen?")) return;
    await (supabase.from as any)("equipment").delete().eq("id", id);
    load();
  };

  const updateSpec = (i: number, field: "key" | "value", v: string) => {
    if (!editing) return;
    const specs = [...editing.specs];
    specs[i] = { ...specs[i], [field]: v };
    setEditing({ ...editing, specs });
  };
  const addSpec = () => editing && setEditing({ ...editing, specs: [...editing.specs, { key: "", value: "" }] });
  const removeSpec = (i: number) => editing && setEditing({ ...editing, specs: editing.specs.filter((_, idx) => idx !== i) });

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading text-3xl font-bold mb-1">Maschinen & Equipment</h1>
          <p className="text-muted-foreground">Verwaltet die Drucker und Maschinen für die öffentliche Seite /maschinen.</p>
        </div>
        <Button onClick={startNew}><Plus className="w-4 h-4 mr-1" /> Neue Maschine</Button>
      </div>

      {editing && (
        <div className="bg-card border border-border rounded-xl p-5 mb-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Name</Label><Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></div>
            <div><Label>Sortierung</Label><Input type="number" value={editing.sort_order} onChange={e => setEditing({ ...editing, sort_order: Number(e.target.value) })} /></div>
          </div>
          <div><Label>Beschreibung</Label><Textarea rows={4} value={editing.beschreibung} onChange={e => setEditing({ ...editing, beschreibung: e.target.value })} /></div>

          <div>
            <div className="flex items-center justify-between mb-2"><Label>Specs (Key / Value)</Label><Button size="sm" variant="outline" onClick={addSpec}><Plus className="w-3 h-3 mr-1" />Spec</Button></div>
            <div className="space-y-2">
              {editing.specs.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <Input placeholder="z.B. Bauraum" value={s.key} onChange={e => updateSpec(i, "key", e.target.value)} />
                  <Input placeholder="z.B. 250×210×210 mm" value={s.value} onChange={e => updateSpec(i, "value", e.target.value)} />
                  <Button size="icon" variant="ghost" onClick={() => removeSpec(i)}><X className="w-4 h-4" /></Button>
                </div>
              ))}
              {editing.specs.length === 0 && <p className="text-xs text-muted-foreground">Noch keine Specs.</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Vorschaubild</Label>
              <Input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} />
              {editing.vorschaubild_url && !imageFile && <img src={editing.vorschaubild_url} alt="" className="mt-2 h-16 rounded object-cover" />}
            </div>
            <div>
              <Label>3D-Modell (.glb / .gltf)</Label>
              <Input type="file" accept=".glb,.gltf,.3mf,model/gltf-binary,model/gltf+json" onChange={e => setModelFile(e.target.files?.[0] || null)} />
              {editing.modell_url && !modelFile && (
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-muted-foreground truncate flex-1">Aktuell: {editing.modell_url.split("/").pop()}</p>
                  <Button size="sm" variant="outline" onClick={() => setCalibration({ url: editing.modell_url!, rotation: editing.model_rotation || { x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0 } })}>Ausrichten</Button>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2"><Switch checked={editing.aktiv} onCheckedChange={v => setEditing({ ...editing, aktiv: v })} /><Label>Aktiv</Label></div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}>Abbrechen</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Speichern…" : "Speichern"}</Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map(it => (
          <div key={it.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            {it.vorschaubild_url ? <img src={it.vorschaubild_url} alt={it.name} className="w-16 h-16 object-cover rounded" /> : <div className="w-16 h-16 rounded bg-muted" />}
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{it.name}</p>
              <p className="text-xs text-muted-foreground truncate">{it.beschreibung}</p>
              <p className="text-xs text-muted-foreground">{it.aktiv ? "Aktiv" : "Inaktiv"} · #{it.sort_order}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => startEdit(it)}>Bearbeiten</Button>
            <Button size="sm" variant="ghost" onClick={() => remove(it.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
          </div>
        ))}
        {items.length === 0 && <p className="text-muted-foreground text-sm col-span-full">Noch keine Einträge.</p>}
      </div>

      <Dialog open={!!calibration} onOpenChange={(o) => !o && setCalibration(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>3D-Modell ausrichten</DialogTitle></DialogHeader>
          {calibration && (
            <div className="space-y-4">
              <div className="bg-muted rounded-lg overflow-hidden h-[400px]">
                <ModelViewer url={calibration.url} rotation={calibration.rotation} showAxes />
              </div>
              {(["x", "y", "z"] as const).map(axis => (
                <div key={axis}>
                  <div className="flex justify-between mb-2">
                    <Label>{axis.toUpperCase()}-Achse (Rotation)</Label>
                    <span className="text-sm text-muted-foreground">{Math.round(calibration.rotation[axis])}°</span>
                  </div>
                  <Slider
                    min={-180} max={180} step={1}
                    value={[calibration.rotation[axis]]}
                    onValueChange={([v]) => setCalibration({ ...calibration, rotation: { ...calibration.rotation, [axis]: v } })}
                  />
                </div>
              ))}
              {(["px", "py", "pz"] as const).map(axis => (
                <div key={axis}>
                  <div className="flex justify-between mb-2 items-center gap-2">
                    <Label>{axis.charAt(1).toUpperCase()}-Position</Label>
                    <Input
                      type="number"
                      className="w-24 h-8"
                      value={calibration.rotation[axis]}
                      onChange={e => setCalibration({ ...calibration, rotation: { ...calibration.rotation, [axis]: Number(e.target.value) || 0 } })}
                    />
                  </div>
                  <Slider
                    min={-100} max={100} step={1}
                    value={[calibration.rotation[axis]]}
                    onValueChange={([v]) => setCalibration({ ...calibration, rotation: { ...calibration.rotation, [axis]: v } })}
                  />
                </div>
              ))}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setCalibration({ ...calibration, rotation: { x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0 } })}>Zurücksetzen</Button>
                <Button onClick={saveCalibration}>So ist es gut ✓</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
