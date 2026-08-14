import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Save, Eye, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

interface Post {
  id: string; slug: string; titel: string;
  inhalt: string; zusammenfassung: string | null;
  titelbild_url: string | null; autor: string;
  veroeffentlicht: boolean; veroeffentlicht_am: string | null;
  tags: string[] | null;
}

const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function BlogAdminPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [editing, setEditing] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [uploading, setUploading] = useState<"cover" | "inline" | null>(null);

  const uploadImage = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `blog/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("projekte").upload(path, file, { upsert: false });
    if (error) { toast.error(error.message); return null; }
    return supabase.storage.from("projekte").getPublicUrl(path).data.publicUrl;
  };

  const handleCoverUpload = async (file: File) => {
    setUploading("cover");
    const url = await uploadImage(file);
    setUploading(null);
    if (url && editing) { setEditing({ ...editing, titelbild_url: url }); toast.success("Titelbild hochgeladen"); }
  };

  const handleInlineUpload = async (file: File) => {
    setUploading("inline");
    const url = await uploadImage(file);
    setUploading(null);
    if (url && editing) {
      setEditing({ ...editing, inhalt: `${editing.inhalt}\n\n![Bild](${url})\n` });
      toast.success("Bild in den Text eingefügt");
    }
  };


  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("blog_posts" as any).select("*").order("created_at", { ascending: false });
    setPosts((data as unknown as Post[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing) return;
    const payload: any = {
      ...editing,
      slug: editing.slug || slugify(editing.titel),
      veroeffentlicht_am: editing.veroeffentlicht && !editing.veroeffentlicht_am ? new Date().toISOString() : editing.veroeffentlicht_am,
    };
    if (editing.id) {
      const { id, ...rest } = payload;
      const { error } = await supabase.from("blog_posts" as any).update(rest).eq("id", id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { id, ...rest } = payload;
      const { error } = await supabase.from("blog_posts" as any).insert(rest);
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Gespeichert");
    setEditing(null); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Beitrag löschen?")) return;
    await supabase.from("blog_posts" as any).delete().eq("id", id);
    load();
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading text-xl md:text-3xl font-bold text-foreground mb-1 flex items-center gap-2"><FileText className="w-6 h-6 text-primary" /> Blog / News</h1>
          <p className="text-muted-foreground">Beiträge erstellen und veröffentlichen.</p>
        </div>
        <Button onClick={() => setEditing({
          id: "", slug: "", titel: "", inhalt: "", zusammenfassung: "",
          titelbild_url: null, autor: "3DMuscio Team", veroeffentlicht: false,
          veroeffentlicht_am: null, tags: [],
        } as any)}>
          <Plus className="w-4 h-4 mr-1" /> Neuer Beitrag
        </Button>
      </div>

      {loading ? <p>Lädt…</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {posts.map(p => (
            <div key={p.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading font-bold text-foreground">{p.titel}</h3>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${p.veroeffentlicht ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                      {p.veroeffentlicht ? "live" : "entwurf"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {p.slug}
                    {p.veroeffentlicht_am && ` · ${new Date(p.veroeffentlicht_am).toLocaleDateString("de-CH")}`}
                  </p>
                  {p.zusammenfassung && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{p.zusammenfassung}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
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
          <div className="bg-card border border-border rounded-2xl p-4 md:p-6 max-w-5xl w-full max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-xl font-bold">{editing.id ? "Beitrag bearbeiten" : "Neuer Beitrag"}</h2>
              <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)}>
                <Eye className="w-3.5 h-3.5 mr-1" /> {showPreview ? "Editor" : "Vorschau"}
              </Button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><Label>Titel *</Label><Input value={editing.titel} onChange={e => setEditing({ ...editing, titel: e.target.value, slug: editing.slug || slugify(e.target.value) })} /></div>
                <div><Label>Slug</Label><Input value={editing.slug} onChange={e => setEditing({ ...editing, slug: slugify(e.target.value) })} /></div>
              </div>
              <div><Label>Zusammenfassung</Label><Textarea rows={2} value={editing.zusammenfassung || ""} onChange={e => setEditing({ ...editing, zusammenfassung: e.target.value })} /></div>
              <div><Label>Titelbild URL</Label><Input value={editing.titelbild_url || ""} onChange={e => setEditing({ ...editing, titelbild_url: e.target.value })} placeholder="https://..." /></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><Label>Autor</Label><Input value={editing.autor} onChange={e => setEditing({ ...editing, autor: e.target.value })} /></div>
                <div><Label>Tags (Komma getrennt)</Label><Input value={(editing.tags || []).join(", ")} onChange={e => setEditing({ ...editing, tags: e.target.value.split(",").map(t => t.trim()).filter(Boolean) })} /></div>
              </div>

              <div>
                <Label>Inhalt (Markdown)</Label>
                {showPreview ? (
                  <div className="border border-border rounded-lg p-4 min-h-[400px] bg-background prose prose-invert max-w-none prose-headings:font-heading prose-a:text-primary">
                    <ReactMarkdown>{editing.inhalt}</ReactMarkdown>
                  </div>
                ) : (
                  <Textarea rows={20} value={editing.inhalt} onChange={e => setEditing({ ...editing, inhalt: e.target.value })} className="font-mono text-sm" />
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-border pt-4">
                <div>
                  <Label>Veröffentlichungsdatum</Label>
                  <Input
                    type="datetime-local"
                    value={toLocalInput(editing.veroeffentlicht_am)}
                    onChange={e => setEditing({ ...editing, veroeffentlicht_am: e.target.value ? new Date(e.target.value).toISOString() : null })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Leer = wird beim Veröffentlichen automatisch gesetzt.</p>
                </div>
                <div className="flex items-center gap-3 md:pt-6">
                  <Switch checked={editing.veroeffentlicht} onCheckedChange={v => setEditing({ ...editing, veroeffentlicht: v })} />
                  <Label>Veröffentlicht</Label>
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
