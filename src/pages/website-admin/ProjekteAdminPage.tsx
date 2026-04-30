import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Save, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface Project {
  id: string; slug: string; name: string;
  kategorie: string | null; beschreibung: string | null; kurzbeschreibung: string | null;
  bild_url: string | null; verfahren: string | null; material: string | null;
  toleranz: string | null; lieferzeit: string | null;
  sort_order: number; featured: boolean; aktiv: boolean;
}

const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function ProjekteAdminPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [editing, setEditing] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("projekte").select("*").order("sort_order");
    setProjects((data as Project[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing) return;
    const payload = { ...editing, slug: editing.slug || slugify(editing.name) };
    if (editing.id) {
      const { id, ...rest } = payload;
      await supabase.from("projekte").update(rest).eq("id", id);
    } else {
      const { id, ...rest } = payload;
      await supabase.from("projekte").insert(rest);
    }
    toast.success("Gespeichert");
    setEditing(null); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Projekt löschen?")) return;
    await supabase.from("projekte").delete().eq("id", id);
    load();
  };

  const onUpload = async (file: File) => {
    if (!editing) return;
    const path = `${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from("projekte").upload(path, file);
    if (error) { toast.error(error.message); return; }
    const { data } = supabase.storage.from("projekte").getPublicUrl(path);
    setEditing({ ...editing, bild_url: data.publicUrl });
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading text-3xl font-bold text-foreground mb-1">Projekte / Portfolio</h1>
          <p className="text-muted-foreground">Referenzprojekte für die Website verwalten.</p>
        </div>
        <Button onClick={() => setEditing({ id: "", slug: "", name: "", kategorie: "", beschreibung: "", kurzbeschreibung: "", bild_url: null, verfahren: "", material: "", toleranz: "", lieferzeit: "", sort_order: projects.length + 1, featured: false, aktiv: true })}>
          <Plus className="w-4 h-4 mr-1" /> Neues Projekt
        </Button>
      </div>

      {loading ? <p>Lädt…</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(p => (
            <div key={p.id} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="aspect-video bg-muted flex items-center justify-center">
                {p.bild_url ? <img src={p.bild_url} alt={p.name} className="w-full h-full object-cover" /> : <ImageIcon className="w-10 h-10 text-muted-foreground/40" />}
              </div>
              <div className="p-4">
                <p className="text-[10px] uppercase tracking-widest text-primary font-bold mb-1">{p.kategorie}</p>
                <h3 className="font-heading font-bold text-foreground mb-3">{p.name}</h3>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(p)}>Bearbeiten</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={() => setEditing(null)}>
          <div className="bg-card border border-border rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="font-heading text-xl font-bold mb-4">{editing.id ? "Projekt bearbeiten" : "Neues Projekt"}</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Name *</Label><Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value, slug: editing.slug || slugify(e.target.value) })} /></div>
                <div><Label>Slug</Label><Input value={editing.slug} onChange={e => setEditing({ ...editing, slug: slugify(e.target.value) })} /></div>
              </div>
              <div><Label>Kategorie</Label><Input value={editing.kategorie || ""} onChange={e => setEditing({ ...editing, kategorie: e.target.value })} /></div>
              <div><Label>Kurzbeschreibung</Label><Input value={editing.kurzbeschreibung || ""} onChange={e => setEditing({ ...editing, kurzbeschreibung: e.target.value })} /></div>
              <div><Label>Beschreibung</Label><Textarea rows={4} value={editing.beschreibung || ""} onChange={e => setEditing({ ...editing, beschreibung: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Verfahren</Label><Input value={editing.verfahren || ""} onChange={e => setEditing({ ...editing, verfahren: e.target.value })} /></div>
                <div><Label>Material</Label><Input value={editing.material || ""} onChange={e => setEditing({ ...editing, material: e.target.value })} /></div>
                <div><Label>Toleranz</Label><Input value={editing.toleranz || ""} onChange={e => setEditing({ ...editing, toleranz: e.target.value })} /></div>
                <div><Label>Lieferzeit</Label><Input value={editing.lieferzeit || ""} onChange={e => setEditing({ ...editing, lieferzeit: e.target.value })} /></div>
              </div>
              <div>
                <Label>Bild</Label>
                <div className="flex gap-3 items-center">
                  {editing.bild_url && <img src={editing.bild_url} className="w-20 h-20 object-cover rounded-lg" />}
                  <input type="file" accept="image/*" onChange={e => e.target.files?.[0] && onUpload(e.target.files[0])} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Sortierung</Label><Input type="number" value={editing.sort_order} onChange={e => setEditing({ ...editing, sort_order: parseInt(e.target.value) || 0 })} /></div>
                <div className="flex items-end gap-4">
                  <div className="flex items-center gap-2"><Switch checked={editing.featured} onCheckedChange={v => setEditing({ ...editing, featured: v })} /><Label>Featured</Label></div>
                  <div className="flex items-center gap-2"><Switch checked={editing.aktiv} onCheckedChange={v => setEditing({ ...editing, aktiv: v })} /><Label>Aktiv</Label></div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setEditing(null)}>Abbrechen</Button>
                <Button onClick={save}><Save className="w-4 h-4 mr-1" /> Speichern</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
