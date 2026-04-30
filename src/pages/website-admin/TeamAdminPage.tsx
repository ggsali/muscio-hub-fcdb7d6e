import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface Member {
  id: string;
  name: string;
  role: string | null;
  bio: string | null;
  photo_path: string | null;
  sort_order: number;
  aktiv: boolean;
}

const photoUrl = (p: string | null) =>
  p ? supabase.storage.from("team-photos").getPublicUrl(p).data.publicUrl : "";

export default function TeamAdminPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", role: "", bio: "", file: null as File | null });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("team_members").select("*").order("sort_order");
    setMembers((data as Member[]) || []);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.name.trim()) { toast.error("Name nötig"); return; }
    setBusy(true);
    let photo_path: string | null = null;
    if (form.file) {
      const path = `${crypto.randomUUID()}-${form.file.name}`;
      const { error } = await supabase.storage.from("team-photos").upload(path, form.file);
      if (error) { toast.error(error.message); setBusy(false); return; }
      photo_path = path;
    }
    const { error } = await supabase.from("team_members").insert({
      name: form.name, role: form.role || null, bio: form.bio || null,
      photo_path, sort_order: members.length + 1, aktiv: true,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setForm({ name: "", role: "", bio: "", file: null });
    setAdding(false);
    toast.success("Teammitglied hinzugefügt");
    load();
  };

  const updateField = async (id: string, field: keyof Member, value: any) => {
    await (supabase.from("team_members") as any).update({ [field]: value }).eq("id", id);
    load();
  };

  const replacePhoto = async (m: Member, file: File) => {
    const path = `${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from("team-photos").upload(path, file);
    if (error) { toast.error(error.message); return; }
    if (m.photo_path) await supabase.storage.from("team-photos").remove([m.photo_path]);
    await updateField(m.id, "photo_path", path);
    toast.success("Foto aktualisiert");
  };

  const remove = async (m: Member) => {
    if (!confirm(`${m.name} löschen?`)) return;
    if (m.photo_path) await supabase.storage.from("team-photos").remove([m.photo_path]);
    await supabase.from("team_members").delete().eq("id", m.id);
    load();
  };

  const move = async (m: Member, dir: -1 | 1) => {
    const idx = members.findIndex(x => x.id === m.id);
    const swap = members[idx + dir];
    if (!swap) return;
    await supabase.from("team_members").update({ sort_order: swap.sort_order }).eq("id", m.id);
    await supabase.from("team_members").update({ sort_order: m.sort_order }).eq("id", swap.id);
    load();
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold mb-1">Team</h1>
          <p className="text-muted-foreground text-sm">Personen, die im "Über uns"-Bereich vorgestellt werden.</p>
        </div>
        <Button onClick={() => setAdding(true)}><Plus className="w-4 h-4 mr-1" /> Person hinzufügen</Button>
      </div>

      {adding && (
        <div className="bg-card border border-border rounded-xl p-5 mb-6 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Rolle / Funktion</Label><Input value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} placeholder="z. B. Gründer & 3D-Spezialist" /></div>
          </div>
          <div><Label>Kurzbiografie</Label><Textarea rows={3} value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} /></div>
          <div><Label>Foto</Label><Input type="file" accept="image/*" onChange={e => setForm({ ...form, file: e.target.files?.[0] || null })} /></div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAdding(false)}>Abbrechen</Button>
            <Button onClick={add} disabled={busy}>{busy ? "Speichern…" : "Hinzufügen"}</Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {members.map((m, i) => {
          const photo = photoUrl(m.photo_path);
          return (
            <div key={m.id} className="bg-card border border-border rounded-xl p-4 md:p-5 flex flex-col md:flex-row gap-4 items-start">
              {photo ? (
                <img src={photo} alt={m.name} className="w-20 h-20 rounded-full object-cover border border-border flex-shrink-0" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center flex-shrink-0 text-2xl font-bold text-muted-foreground">{m.name[0]}</div>
              )}

              <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-2 gap-2 w-full">
                <Input defaultValue={m.name} onBlur={e => e.target.value !== m.name && updateField(m.id, "name", e.target.value)} placeholder="Name" />
                <Input defaultValue={m.role || ""} onBlur={e => e.target.value !== (m.role || "") && updateField(m.id, "role", e.target.value || null)} placeholder="Rolle" />
                <Textarea className="md:col-span-2" rows={2} defaultValue={m.bio || ""} onBlur={e => e.target.value !== (m.bio || "") && updateField(m.id, "bio", e.target.value || null)} placeholder="Kurzbio" />
                <div className="md:col-span-2 flex flex-wrap items-center gap-3 text-xs">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <span className="text-muted-foreground">Foto ändern</span>
                    <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && replacePhoto(m, e.target.files[0])} />
                    <span className="px-2 py-1 rounded border border-border hover:bg-muted">Datei wählen</span>
                  </label>
                  <span className="inline-flex items-center gap-1.5">
                    <Switch checked={m.aktiv} onCheckedChange={v => updateField(m.id, "aktiv", v)} />
                    <span className="text-muted-foreground">{m.aktiv ? "Sichtbar" : "Versteckt"}</span>
                  </span>
                </div>
              </div>

              <div className="flex md:flex-col gap-1">
                <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => move(m, -1)}><ArrowUp className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" disabled={i === members.length - 1} onClick={() => move(m, 1)}><ArrowDown className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => remove(m)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
            </div>
          );
        })}
        {members.length === 0 && !adding && (
          <p className="text-muted-foreground text-sm text-center py-8">Noch keine Teammitglieder. Klicke oben auf "Person hinzufügen".</p>
        )}
      </div>
    </div>
  );
}
