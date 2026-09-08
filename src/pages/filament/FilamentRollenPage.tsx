import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Search, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import FilamentTypeForm from "@/components/filament/FilamentTypeForm";
import {
  loadTypes,
  nextSpoolNumber,
  formatSpoolCode,
  typeLabel,
  type FilamentSpool,
  type FilamentType,
} from "@/lib/filamentLager";

export default function FilamentRollenPage() {
  const [types, setTypes] = useState<FilamentType[]>([]);
  const [typeId, setTypeId] = useState("");
  const [typeQuery, setTypeQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [anzahl, setAnzahl] = useState(1);
  const [gewicht, setGewicht] = useState(1000);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<FilamentSpool[]>([]);
  const [deleteSpool, setDeleteSpool] = useState<FilamentSpool | null>(null);
  const [working, setWorking] = useState(false);

  const load = async () => {
    try { setTypes(await loadTypes()); } catch (e: any) { toast.error("Laden fehlgeschlagen: " + e.message); }
  };
  useEffect(() => { load(); }, []);

  const filteredTypes = useMemo(() => {
    const s = typeQuery.trim().toLowerCase();
    if (!s) return types;
    return types.filter(t => [t.material, t.farbe, t.hersteller || ""].join(" ").toLowerCase().includes(s));
  }, [types, typeQuery]);

  const typeMap = useMemo(() => Object.fromEntries(types.map(t => [t.id, t])), [types]);

  const save = async () => {
    if (!typeId) { toast.error("Bitte eine Filamentart wählen"); return; }
    const count = Math.max(1, Math.min(500, Number(anzahl) || 0));
    setSaving(true);
    try {
      const start = await nextSpoolNumber();
      const rows = Array.from({ length: count }, (_, i) => ({
        spool_code: formatSpoolCode(start + i),
        filament_type_id: typeId,
        gewicht_g: Math.max(1, Number(gewicht) || 1000),
      }));
      const { data, error } = await supabase.from("filament_spools").insert(rows).select();
      if (error) throw error;
      const neu = (data || []) as FilamentSpool[];
      setCreated(prev => [...neu, ...prev]);
      const from = rows[0].spool_code;
      const to = rows[rows.length - 1].spool_code;
      toast.success(
        count === 1 ? `Rolle ${from} angelegt` : `${count} Rollen angelegt: ${from} – ${to}`
      );
      setAnzahl(1);
    } catch (e: any) {
      toast.error("Anlegen fehlgeschlagen: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (spool: FilamentSpool, status: string) => {
    const emptied_at = status === "leer" ? new Date().toISOString() : null;
    const { error } = await supabase.from("filament_spools").update({ status, emptied_at }).eq("id", spool.id);
    if (error) { toast.error("Fehlgeschlagen: " + error.message); return; }
    setCreated(prev => prev.map(s => (s.id === spool.id ? { ...s, status, emptied_at } : s)));
    toast.success(`${spool.spool_code} als ${status} markiert`);
  };

  const confirmDelete = async () => {
    if (!deleteSpool) return;
    setWorking(true);
    const { error } = await supabase.from("filament_spools").delete().eq("id", deleteSpool.id);
    setWorking(false);
    if (error) { toast.error("Löschen fehlgeschlagen: " + error.message); return; }
    setCreated(prev => prev.filter(s => s.id !== deleteSpool.id));
    toast.success(`Rolle ${deleteSpool.spool_code} gelöscht`);
    setDeleteSpool(null);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl md:text-2xl font-bold">Rollen anlegen</h1>
        <p className="text-sm text-muted-foreground">Neue Rollen mit fortlaufendem Code erfassen</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div className="space-y-1.5">
          <Label>Filamentart</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={typeQuery}
              onChange={e => setTypeQuery(e.target.value)}
              placeholder="Liste filtern…"
              className="pl-9 bg-input border-border"
            />
          </div>
          <select
            value={typeId}
            onChange={e => {
              if (e.target.value === "__new__") { setShowForm(true); return; }
              setTypeId(e.target.value);
            }}
            className="w-full h-10 rounded-md border border-border bg-input px-3 text-sm"
          >
            <option value="">– bitte wählen –</option>
            {filteredTypes.map(t => (
              <option key={t.id} value={t.id}>
                {typeLabel(t)}{t.hersteller ? ` (${t.hersteller})` : ""}
              </option>
            ))}
            <option value="__new__">+ Neue Filamentart anlegen…</option>
          </select>
        </div>

        {showForm && (
          <FilamentTypeForm
            onSaved={(t) => { setTypes(prev => [...prev, t]); setTypeId(t.id); setShowForm(false); }}
            onCancel={() => setShowForm(false)}
          />
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Anzahl Rollen</Label>
            <Input type="number" min={1} value={anzahl} onChange={e => setAnzahl(parseInt(e.target.value) || 1)} className="bg-input border-border" />
          </div>
          <div className="space-y-1.5">
            <Label>Gewicht pro Rolle (g)</Label>
            <Input type="number" min={1} value={gewicht} onChange={e => setGewicht(parseInt(e.target.value) || 1000)} className="bg-input border-border" />
          </div>
        </div>

        <Button onClick={save} disabled={saving}>
          <Plus className="w-4 h-4 mr-1.5" /> {saving ? "Legt an…" : "Rollen anlegen"}
        </Button>
      </div>

      {created.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold">Gerade angelegte Rollen</h2>
            <p className="text-xs text-muted-foreground">Falsch erfasste Rollen hier direkt löschen oder Status ändern</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Code</th>
                <th className="text-left px-4 py-2 font-medium">Filamentart</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-right px-4 py-2 font-medium">Gewicht</th>
                <th className="text-right px-4 py-2 font-medium">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {created.map(s => {
                const t = typeMap[s.filament_type_id];
                return (
                  <tr key={s.id} className="border-t border-border">
                    <td className="px-4 py-2 font-mono">{s.spool_code}</td>
                    <td className="px-4 py-2 text-muted-foreground">{t ? typeLabel(t) : "—"}</td>
                    <td className="px-4 py-2">
                      <select
                        value={s.status}
                        onChange={e => setStatus(s, e.target.value)}
                        className="h-8 rounded-md border border-border bg-input px-2 text-xs"
                      >
                        <option value="voll">voll</option>
                        <option value="leer">leer</option>
                      </select>
                    </td>
                    <td className="px-4 py-2 text-right">{s.gewicht_g} g</td>
                    <td className="px-4 py-2 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteSpool(s)}
                        aria-label="Rolle löschen"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog open={!!deleteSpool} onOpenChange={(v) => { if (!v) setDeleteSpool(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Wirklich löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Rolle {deleteSpool?.spool_code} wird endgültig aus dem Lager entfernt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDelete(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {working ? "Löscht…" : "Löschen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
