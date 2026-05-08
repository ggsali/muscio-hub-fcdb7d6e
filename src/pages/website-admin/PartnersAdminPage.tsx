import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface Partner { id: string; name: string; logo_path: string | null; website_url: string | null; sort_order: number; aktiv: boolean; }

export default function PartnersAdminPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", website_url: "", file: null as File | null });

  const load = async () => {
    const { data } = await supabase.from("partners").select("*").order("sort_order");
    setPartners((data as Partner[]) || []);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.name.trim()) return;
    let logo_path: string | null = null;
    if (form.file) {
      const path = `${crypto.randomUUID()}-${form.file.name}`;
      const { error } = await supabase.storage.from("partners").upload(path, form.file);
      if (error) { toast.error(error.message); return; }
      logo_path = supabase.storage.from("partners").getPublicUrl(path).data.publicUrl;
    }
    await supabase.from("partners").insert({ name: form.name, website_url: form.website_url || null, logo_path, sort_order: partners.length + 1 });
    setForm({ name: "", website_url: "", file: null }); setAdding(false); load();
  };

  const toggle = async (p: Partner) => { await supabase.from("partners").update({ aktiv: !p.aktiv }).eq("id", p.id); load(); };
  const remove = async (id: string) => { if (!confirm("Partner löschen?")) return; await supabase.from("partners").delete().eq("id", id); load(); };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading text-xl md:text-3xl font-bold mb-1">Partner</h1>
          <p className="text-muted-foreground">Logos der Partnerfirmen für den Marquee-Slider.</p>
        </div>
        <Button onClick={() => setAdding(true)}><Plus className="w-4 h-4 mr-1" /> Partner</Button>
      </div>

      {adding && (
        <div className="bg-card border border-border rounded-xl p-5 mb-6 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Website</Label><Input value={form.website_url} onChange={e => setForm({ ...form, website_url: e.target.value })} placeholder="https://…" /></div>
          </div>
          <div><Label>Logo</Label><Input type="file" accept="image/*" onChange={e => setForm({ ...form, file: e.target.files?.[0] || null })} /></div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setAdding(false)}>Abbrechen</Button><Button onClick={add}>Hinzufügen</Button></div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {partners.map(p => (
          <div key={p.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            {p.logo_path ? <img src={p.logo_path} alt={p.name} className="w-12 h-12 object-contain bg-muted rounded p-1" /> : <div className="w-12 h-12 rounded bg-muted" />}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{p.name}</p>
              {p.website_url && <p className="text-xs text-muted-foreground truncate">{p.website_url}</p>}
            </div>
            <Switch checked={p.aktiv} onCheckedChange={() => toggle(p)} />
            <Button size="sm" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
          </div>
        ))}
        {partners.length === 0 && <p className="text-muted-foreground text-sm col-span-full">Noch keine Partner.</p>}
      </div>
    </div>
  );
}
