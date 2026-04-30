import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, ArrowUp, ArrowDown, Save, Clock } from "lucide-react";

interface TLEvent {
  id: string;
  jahr: string;
  titel: string;
  beschreibung: string | null;
  icon: string | null;
  sort_order: number;
  aktiv: boolean;
}

const ICON_OPTIONS = ["Sparkles", "Rocket", "Layers", "Globe", "Building2", "Award", "Users", "Target", "Lightbulb", "Star", "Trophy", "Zap"];

export default function TimelineAdminPage() {
  const [events, setEvents] = useState<TLEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

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
      jahr: e.jahr, titel: e.titel, beschreibung: e.beschreibung, icon: e.icon, sort_order: e.sort_order, aktiv: e.aktiv,
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

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-5 h-5 text-primary" />
            <h1 className="font-heading text-2xl font-bold">Zeitleiste</h1>
          </div>
          <p className="text-sm text-muted-foreground">Verwalte die Ereignisse auf der "Über uns"-Seite.</p>
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
          {events.map((e, i) => (
            <div key={e.id} className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-start gap-3">
                <div className="flex flex-col gap-1 pt-1">
                  <button onClick={() => move(e.id, -1)} disabled={i === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowUp className="w-4 h-4" /></button>
                  <button onClick={() => move(e.id, 1)} disabled={i === events.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowDown className="w-4 h-4" /></button>
                </div>
                <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-xs">Jahr</Label>
                    <Input value={e.jahr} onChange={ev => update(e.id, { jahr: ev.target.value })} />
                  </div>
                  <div className="md:col-span-7 space-y-1.5">
                    <Label className="text-xs">Titel</Label>
                    <Input value={e.titel} onChange={ev => update(e.id, { titel: ev.target.value })} />
                  </div>
                  <div className="md:col-span-3 space-y-1.5">
                    <Label className="text-xs">Icon</Label>
                    <select
                      value={e.icon || "Sparkles"}
                      onChange={ev => update(e.id, { icon: ev.target.value })}
                      className="w-full h-10 rounded-md bg-background border border-input px-3 text-sm"
                    >
                      {ICON_OPTIONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-12 space-y-1.5">
                    <Label className="text-xs">Beschreibung</Label>
                    <Textarea rows={2} value={e.beschreibung || ""} onChange={ev => update(e.id, { beschreibung: ev.target.value })} />
                  </div>
                  <div className="md:col-span-12 flex items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-2">
                      <Switch checked={e.aktiv} onCheckedChange={c => update(e.id, { aktiv: c })} />
                      <span className="text-xs text-muted-foreground">{e.aktiv ? "Sichtbar" : "Versteckt"}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => remove(e.id)} className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                      <Button size="sm" onClick={() => save(e)} disabled={savingId === e.id}>
                        <Save className="w-4 h-4 mr-1" />{savingId === e.id ? "…" : "Speichern"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
