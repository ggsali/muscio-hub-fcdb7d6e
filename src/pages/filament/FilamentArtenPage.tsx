import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, AlertTriangle, Pencil, Trash2 } from "lucide-react";
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
import FilamentTypeEditDialog from "@/components/filament/FilamentTypeEditDialog";
import { loadSpools, loadTypes, fullCountByType, type FilamentSpool, type FilamentType } from "@/lib/filamentLager";

export default function FilamentArtenPage() {
  const [types, setTypes] = useState<FilamentType[]>([]);
  const [spools, setSpools] = useState<FilamentSpool[]>([]);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editType, setEditType] = useState<FilamentType | null>(null);
  const [deleteType, setDeleteType] = useState<FilamentType | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    try {
      const [t, s] = await Promise.all([loadTypes(), loadSpools()]);
      setTypes(t);
      setSpools(s);
    } catch (e: any) {
      toast.error("Laden fehlgeschlagen: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const counts = useMemo(() => fullCountByType(spools), [spools]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return types;
    return types.filter(t =>
      [t.material, t.farbe, t.hersteller || ""].join(" ").toLowerCase().includes(s)
    );
  }, [types, q]);

  const confirmDelete = async () => {
    if (!deleteType) return;
    setDeleting(true);
    const { error } = await supabase.from("filament_types").delete().eq("id", deleteType.id);
    setDeleting(false);
    if (error) { toast.error("Löschen fehlgeschlagen: " + error.message); return; }
    toast.success(`"${deleteType.material} ${deleteType.farbe}" gelöscht`);
    setTypes(prev => prev.filter(t => t.id !== deleteType.id));
    setSpools(prev => prev.filter(s => s.filament_type_id !== deleteType.id));
    setDeleteType(null);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Filamentarten</h1>
          <p className="text-sm text-muted-foreground">Internes Lager – Materialien, Farben und Mindestbestände</p>
        </div>
        <Button onClick={() => setShowForm(v => !v)}>
          <Plus className="w-4 h-4 mr-1.5" /> Neue Filamentart
        </Button>
      </div>

      {showForm && (
        <FilamentTypeForm
          onSaved={(t) => { setTypes(prev => [...prev, t]); setShowForm(false); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Suchen nach Material, Farbe, Hersteller…"
          className="pl-9 bg-input border-border"
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Lädt…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">Keine Filamentarten gefunden.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map(t => {
            const voll = counts[t.id] || 0;
            const knapp = voll <= t.mindestbestand;
            return (
              <div
                key={t.id}
                className={`rounded-xl border bg-card p-4 space-y-3 ${knapp ? "border-destructive/60" : "border-border"}`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="w-9 h-9 rounded-lg border border-border flex-shrink-0"
                    style={{ backgroundColor: t.farbcode || "#888888" }}
                  />
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{t.material} · {t.farbe}</p>
                    <p className="text-xs text-muted-foreground truncate">{t.hersteller || "Hersteller unbekannt"}</p>
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-2xl font-bold">{voll}</p>
                    <p className="text-xs text-muted-foreground">volle Rollen</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Minimum: {t.mindestbestand}</p>
                </div>
                {knapp && (
                  <div className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                    <AlertTriangle className="w-3.5 h-3.5" /> knapp – nachbestellen
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setEditType(t)}>
                    <Pencil className="w-3.5 h-3.5 mr-1.5" /> Bearbeiten
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteType(t)}
                    aria-label="Filamentart löschen"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <FilamentTypeEditDialog
        type={editType}
        open={!!editType}
        onOpenChange={(v) => { if (!v) setEditType(null); }}
        onSaved={(t) => setTypes(prev => prev.map(x => (x.id === t.id ? t : x)))}
      />

      <AlertDialog open={!!deleteType} onOpenChange={(v) => { if (!v) setDeleteType(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Wirklich löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Filamentart „{deleteType?.material} {deleteType?.farbe}“ löschen? Alle verknüpften Rollen werden ebenfalls gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDelete(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Löscht…" : "Löschen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
