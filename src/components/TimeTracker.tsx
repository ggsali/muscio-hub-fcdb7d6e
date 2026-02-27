import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Square, Clock, Trash2, ChevronDown, ChevronUp, Timer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TimeEntry {
  id: string;
  order_id: string;
  part_id: string | null;
  kategorie: string;
  started_at: string;
  stopped_at: string | null;
  dauer_sekunden: number | null;
  notiz: string | null;
}

interface Part {
  id?: string;
  teilname: string;
}

interface TimeTrackerProps {
  orderId: string;
  parts: Part[];
}

const KATEGORIEN = ["Druck", "Nachbearbeitung", "Konstruktion", "Sonstiges"] as const;

const KATEGORIE_COLORS: Record<string, string> = {
  Druck: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Nachbearbeitung: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  Konstruktion: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  Sonstiges: "bg-muted text-muted-foreground border-border",
};

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

function formatDurationH(seconds: number): string {
  return (seconds / 3600).toFixed(2) + "h";
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function TimeTracker({ orderId, parts }: TimeTrackerProps) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [selectedKategorie, setSelectedKategorie] = useState<string>("Druck");
  const [selectedPartId, setSelectedPartId] = useState<string>("");
  const [notiz, setNotiz] = useState("");
  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadEntries();
  }, [orderId]);

  useEffect(() => {
    if (activeEntry) {
      const start = new Date(activeEntry.started_at).getTime();
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - start) / 1000));
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setElapsed(0);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [activeEntry]);

  async function loadEntries() {
    setLoading(true);
    const { data } = await supabase
      .from("time_entries" as any)
      .select("*")
      .eq("order_id", orderId)
      .order("started_at", { ascending: false });
    if (data) {
      const all = (data as unknown) as TimeEntry[];
      setEntries(all.filter(e => e.stopped_at !== null));
      const running = all.find(e => e.stopped_at === null);
      setActiveEntry(running || null);
    }
    setLoading(false);
  }

  async function startTimer() {
    if (activeEntry) return;
    const { data, error } = await supabase
      .from("time_entries" as any)
      .insert({
        order_id: orderId,
        part_id: selectedPartId || null,
        kategorie: selectedKategorie,
        notiz: notiz || null,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      return;
    }
    setActiveEntry((data as unknown) as TimeEntry);
    setNotiz("");
  }

  async function stopTimer() {
    if (!activeEntry) return;
    const stoppedAt = new Date().toISOString();
    const dauer = Math.floor((new Date(stoppedAt).getTime() - new Date(activeEntry.started_at).getTime()) / 1000);
    const { error } = await supabase
      .from("time_entries" as any)
      .update({ stopped_at: stoppedAt, dauer_sekunden: dauer })
      .eq("id", activeEntry.id);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `${activeEntry.kategorie} gestoppt`, description: `Dauer: ${formatDuration(dauer)}` });
    setActiveEntry(null);
    loadEntries();
  }

  async function deleteEntry(id: string) {
    await supabase.from("time_entries" as any).delete().eq("id", id);
    setEntries(prev => prev.filter(e => e.id !== id));
  }

  // Totals per Kategorie
  const totals = KATEGORIEN.reduce((acc, k) => {
    acc[k] = entries.filter(e => e.kategorie === k).reduce((s, e) => s + (e.dauer_sekunden || 0), 0);
    return acc;
  }, {} as Record<string, number>);
  const totalAll = Object.values(totals).reduce((s, v) => s + v, 0);

  const partName = (partId: string | null) => {
    if (!partId) return null;
    const p = parts.find(p => p.id === partId);
    return p?.teilname || null;
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className="px-5 py-3 border-b border-border flex items-center justify-between cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-sm">Zeit-Tracker</h2>
          {activeEntry && (
            <span className="flex items-center gap-1 text-xs text-destructive font-medium animate-pulse">
              <span className="w-2 h-2 rounded-full bg-destructive inline-block" />
              Läuft – {formatDuration(elapsed)}
            </span>
          )}
          {totalAll > 0 && !activeEntry && (
            <span className="text-xs text-muted-foreground">Gesamt: {formatDurationH(totalAll)}</span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </div>

      {expanded && (
        <div className="p-5 space-y-5">
          {/* Start-Panel */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Kategorie</label>
              <div className="flex gap-1.5 flex-wrap">
                {KATEGORIEN.map(k => (
                  <button
                    key={k}
                    onClick={() => setSelectedKategorie(k)}
                    disabled={!!activeEntry}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                      selectedKategorie === k
                        ? KATEGORIE_COLORS[k] + " ring-1 ring-current"
                        : "bg-muted/40 text-muted-foreground border-border hover:bg-muted/70"
                    } disabled:opacity-50`}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>

            {parts.filter(p => p.id).length > 0 && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Teil (optional)</label>
                <select
                  value={selectedPartId}
                  onChange={e => setSelectedPartId(e.target.value)}
                  disabled={!!activeEntry}
                  className="h-8 px-2 rounded bg-input border border-border text-xs text-foreground disabled:opacity-50"
                >
                  <option value="">— Auftrag allgemein —</option>
                  {parts.filter(p => p.id).map(p => (
                    <option key={p.id} value={p.id}>{p.teilname || "Unbenanntes Teil"}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1 flex-1 min-w-32">
              <label className="text-xs text-muted-foreground font-medium">Notiz (optional)</label>
              <input
                value={notiz}
                onChange={e => setNotiz(e.target.value)}
                disabled={!!activeEntry}
                placeholder="z.B. Supports entfernen…"
                className="h-8 w-full px-2 rounded bg-input border border-border text-xs text-foreground placeholder:text-muted-foreground disabled:opacity-50 outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            {!activeEntry ? (
              <Button onClick={startTimer} className="gap-2 bg-success hover:bg-success/90 text-success-foreground h-8">
                <Play className="w-3.5 h-3.5" />
                Start
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <div className="font-mono text-2xl font-bold tabular-nums text-foreground min-w-24 text-center">
                  {formatDuration(elapsed)}
                </div>
                <Button onClick={stopTimer} variant="destructive" className="gap-2 h-8">
                  <Square className="w-3.5 h-3.5" />
                  Stop
                </Button>
              </div>
            )}
          </div>

          {/* Aktive Einträge Info */}
          {activeEntry && (
            <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-md border ${KATEGORIE_COLORS[activeEntry.kategorie]}`}>
              <span className="w-2 h-2 rounded-full bg-current animate-pulse inline-block" />
              <strong>{activeEntry.kategorie}</strong>
              {partName(activeEntry.part_id) && <span>· {partName(activeEntry.part_id)}</span>}
              <span className="text-muted-foreground">· Gestartet: {formatTime(activeEntry.started_at)}</span>
              {activeEntry.notiz && <span>· {activeEntry.notiz}</span>}
            </div>
          )}

          {/* Zusammenfassung */}
          {totalAll > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {KATEGORIEN.map(k => totals[k] > 0 && (
                <div key={k} className={`rounded-lg border p-3 ${KATEGORIE_COLORS[k]}`}>
                  <div className="text-xs font-medium opacity-70">{k}</div>
                  <div className="text-lg font-bold tabular-nums">{formatDurationH(totals[k])}</div>
                  <div className="text-xs opacity-60">{formatDuration(totals[k])}</div>
                </div>
              ))}
            </div>
          )}

          {/* Einträge-Liste */}
          {loading ? (
            <div className="text-xs text-muted-foreground py-2">Laden…</div>
          ) : entries.length === 0 && !activeEntry ? (
            <div className="text-xs text-muted-foreground py-2 text-center">
              Noch keine Zeiteinträge. Starte den Timer oben!
            </div>
          ) : entries.length > 0 ? (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground font-medium mb-2 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Verlauf
              </div>
              <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                {entries.map(e => (
                  <div key={e.id} className="flex items-center gap-2 text-xs py-1.5 px-2 rounded hover:bg-muted/30 group">
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-medium ${KATEGORIE_COLORS[e.kategorie]}`}>
                      {e.kategorie}
                    </span>
                    <span className="font-mono font-semibold min-w-12">
                      {formatDuration(e.dauer_sekunden || 0)}
                    </span>
                    <span className="text-muted-foreground">
                      {formatDate(e.started_at)} {formatTime(e.started_at)} – {e.stopped_at ? formatTime(e.stopped_at) : "…"}
                    </span>
                    {partName(e.part_id) && (
                      <span className="text-muted-foreground">· {partName(e.part_id)}</span>
                    )}
                    {e.notiz && <span className="text-muted-foreground italic">· {e.notiz}</span>}
                    <button
                      onClick={() => deleteEntry(e.id)}
                      className="ml-auto opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-border text-xs font-medium">
                <span className="text-muted-foreground">Total erfasste Zeit</span>
                <span className="tabular-nums">{formatDurationH(totalAll)} ({formatDuration(totalAll)})</span>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
