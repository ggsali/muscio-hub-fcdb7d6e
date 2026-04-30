import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, ArrowUp, ArrowDown, Save, Clock, Upload, X, ImageIcon } from "lucide-react";

interface TLEvent {
  id: string;
  jahr: string;
  titel: string;
  beschreibung: string | null;
  icon: string | null;
  image_path: string | null;
  sort_order: number;
  aktiv: boolean;
}

const ICON_OPTIONS = ["Sparkles", "Rocket", "Layers", "Globe", "Building2", "Award", "Users", "Target", "Lightbulb", "Star", "Trophy", "Zap"];

const imageUrl = (p: string | null) =>
  p ? supabase.storage.from("timeline-images").getPublicUrl(p).data.publicUrl : "";

export default function TimelineAdminPage() {
  const [events, setEvents] = useState<TLEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("timeline_events").select("*").order("sort_order");
    if (data) setEvents(data as TLEvent[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addEvent = async () => {
    const next = (events[events.length - 1]?.sort_order ?? 0) + 1;
    const { data, error } = await supabase.from("timeline_events").insert({
      jahr: String(new Date().getFullYear()),
      titel: "Neues Ereignis",
      beschreibung: "",
      icon: "Sparkles",
      sort_order: next,
      aktiv: true,
    }).select().single();
    if (error) return toast.error(error.message);
    setEvents([...events, data as TLEvent]);
  };

  const update = (id: string, patch: Partial<TLEvent>) => {
    setEvents(events.map(e => e.id === id ? { ...e, ...patch } : e));
  };

  const save = async (e: TLEvent) => {
    setSavingId(e.id);
    const { error } = await supabase.from("timeline_events").update({
      jahr: e.jahr, titel: e.titel, beschreibung: e.beschreibung, icon: e.icon,
      image_path: e.image_path, sort_order: e.sort_order, aktiv: e.aktiv,
    }).eq("id", e.id);
    setSavingId(null);
    if (error) return toast.error(error.message);
    toast.success("Gespeichert");
  };

  const remove = async (id: string) => {
    if (!confirm("Wirklich löschen?")) return;
    await supabase.from("timeline_events").delete().eq("id", id);
    setEvents(events.filter(e => e.id !== id));
  };

  const move = async (id: string, dir: -1 | 1) => {
    const idx = events.findIndex(e => e.id === id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= events.length) return;
    const a = events[idx], b = events[swapIdx];
    const newList = [...events];
    newList[idx] = { ...b, sort_order: a.sort_order };
    newList[swapIdx] = { ...a, sort_order: b.sort_order };
    setEvents(newList);
    await Promise.all([
      supabase.from("timeline_events").update({ sort_order: a.sort_order }).eq("id", b.id),
      supabase.from("timeline_events").update({ sort_order: b.sort_order }).eq("id", a.id),
    ]);
  };

  const uploadImage = async (e: TLEvent, file: File) => {
    setUploadingId(e.id);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${e.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("timeline-images").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (upErr) throw upErr;
      // Remove old image
      if (e.image_path) {
        await supabase.storage.from("timeline-images").remove([e.image_path]);
      }
      const { error: dbErr } = await supabase.from("timeline_events").update({ image_path: path }).eq("id", e.id);
      if (dbErr) throw dbErr;
      update(e.id, { image_path: path });
      toast.success("Bild hochgeladen");
    } catch (err: any) {
      toast.error(err.message || "Upload fehlgeschlagen");
    } finally {
      setUploadingId(null);
    }
  };

  const removeImage = async (e: TLEvent) => {
    if (!e.image_path) return;
    if (!confirm("Bild entfernen?")) return;
    await supabase.storage.from("timeline-images").remove([e.image_path]);
    await supabase.from("timeline_events").update({ image_path: null }).eq("id", e.id);
    update(e.id, { image_path: null });
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-5 h-5 text-primary" />
            <h1 className="font-heading text-2xl font-bold">Zeitleiste</h1>
          </div>
          <p className="text-sm text-muted-foreground">Verwalte die Ereignisse auf der "Über uns"-Seite. Bilder erscheinen beim Scrollen mit Pop-Effekt.</p>
        </div>
        <Button onClick={addEvent}><Plus className="w-4 h-4 mr-1" />Neues Ereignis</Button>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Lade…</div>
      ) : events.length === 0 ? (
        <div className="text-sm text-muted-foreground border border-dashed border-border rounded-xl p-8 text-center">
          Noch keine Ereignisse. Klick "Neues Ereignis", um zu starten.
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((e, i) => {
            const img = imageUrl(e.image_path);
            return (
              <div key={e.id} className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col gap-1 pt-1">
                    <button onClick={() => move(e.id, -1)} disabled={i === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowUp className="w-4 h-4" /></button>
                    <button onClick={() => move(e.id, 1)} disabled={i === events.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowDown className="w-4 h-4" /></button>
                  </div>
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-3">
                    {/* Image preview/upload */}
                    <div className="md:col-span-4 space-y-1.5">
                      <Label className="text-xs">Bild</Label>
                      <div className="relative aspect-[16/10] rounded-lg overflow-hidden border border-border bg-muted/40">
                        {img ? (
                          <>
                            <img src={img} alt="" className="w-full h-full object-cover" />
                            <button
                              onClick={() => removeImage(e)}
                              className="absolute top-1.5 right-1.5 p-1 rounded-md bg-background/80 hover:bg-background text-destructive"
                              title="Bild entfernen"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-1 text-xs">
                            <ImageIcon className="w-6 h-6 opacity-50" />
                            <span>Kein Bild</span>
                          </div>
                        )}
                      </div>
                      <input
                        ref={el => { fileInputs.current[e.id] = el; }}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={ev => {
                          const f = ev.target.files?.[0];
                          if (f) uploadImage(e, f);
                          ev.target.value = "";
                        }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => fileInputs.current[e.id]?.click()}
                        disabled={uploadingId === e.id}
                      >
                        <Upload className="w-3.5 h-3.5 mr-1.5" />
                        {uploadingId === e.id ? "Lade…" : img ? "Ersetzen" : "Bild wählen"}
                      </Button>
                    </div>

                    {/* Text fields */}
                    <div className="md:col-span-8 grid grid-cols-12 gap-3">
                      <div className="col-span-4 space-y-1.5">
                        <Label className="text-xs">Jahr</Label>
                        <Input value={e.jahr} onChange={ev => update(e.id, { jahr: ev.target.value })} />
                      </div>
                      <div className="col-span-8 space-y-1.5">
                        <Label className="text-xs">Icon</Label>
                        <select
                          value={e.icon || "Sparkles"}
                          onChange={ev => update(e.id, { icon: ev.target.value })}
                          className="w-full h-10 rounded-md bg-background border border-input px-3 text-sm"
                        >
                          {ICON_OPTIONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
                        </select>
                      </div>
                      <div className="col-span-12 space-y-1.5">
                        <Label className="text-xs">Titel</Label>
                        <Input value={e.titel} onChange={ev => update(e.id, { titel: ev.target.value })} />
                      </div>
                      <div className="col-span-12 space-y-1.5">
                        <Label className="text-xs">Beschreibung</Label>
                        <Textarea rows={3} value={e.beschreibung || ""} onChange={ev => update(e.id, { beschreibung: ev.target.value })} />
                      </div>
                    </div>

                    <div className="md:col-span-12 flex items-center justify-between gap-2 pt-1 border-t border-border">
                      <div className="flex items-center gap-2 pt-3">
                        <Switch checked={e.aktiv} onCheckedChange={c => update(e.id, { aktiv: c })} />
                        <span className="text-xs text-muted-foreground">{e.aktiv ? "Sichtbar" : "Versteckt"}</span>
                      </div>
                      <div className="flex gap-2 pt-3">
                        <Button variant="ghost" size="sm" onClick={() => remove(e.id)} className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                        <Button size="sm" onClick={() => save(e)} disabled={savingId === e.id}>
                          <Save className="w-4 h-4 mr-1" />{savingId === e.id ? "…" : "Speichern"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
