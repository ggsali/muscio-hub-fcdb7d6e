import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Package, AlertTriangle, Trash2, Eye, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import {
  loadTypes,
  loadSpools,
  fullCountByType,
  relativeTime,
  nextSpoolNumber,
  formatSpoolCode,
  type FilamentSpool,
  type FilamentType,
} from "@/lib/filamentLager";

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

export default function FilamentBestandPage() {
  const [types, setTypes] = useState<FilamentType[]>([]);
  const [spools, setSpools] = useState<FilamentSpool[]>([]);
  const [loading, setLoading] = useState(true);

  const [detailType, setDetailType] = useState<FilamentType | null>(null);
  const [deleteSpool, setDeleteSpool] = useState<FilamentSpool | null>(null);
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [korrekturType, setKorrekturType] = useState<FilamentType | null>(null);
  const [zielAnzahl, setZielAnzahl] = useState(0);
  const [working, setWorking] = useState(false);

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
  const vollGesamt = useMemo(() => spools.filter(s => s.status === "voll").length, [spools]);
  const leerGesamt = useMemo(() => spools.filter(s => s.status === "leer").length, [spools]);
  const unterMinimum = useMemo(
    () => types.filter(t => (counts[t.id] || 0) <= t.mindestbestand).length,
    [types, counts]
  );
  const dieseWoche = useMemo(() => {
    const grenze = Date.now() - 7 * 86400000;
    return spools.filter(s => s.emptied_at && new Date(s.emptied_at).getTime() >= grenze).length;
  }, [spools]);
  const letzteLeer = useMemo(
    () =>
      spools
        .filter(s => s.emptied_at)
        .sort((a, b) => new Date(b.emptied_at!).getTime() - new Date(a.emptied_at!).getTime())
        .slice(0, 8),
    [spools]
  );
  const typeMap = useMemo(() => Object.fromEntries(types.map(t => [t.id, t])), [types]);

  const detailSpools = useMemo(
    () =>
      detailType
        ? spools
            .filter(s => s.filament_type_id === detailType.id)
            .sort((a, b) => a.spool_code.localeCompare(b.spool_code))
        : [],
    [spools, detailType]
  );

  const setSpoolStatus = async (spool: FilamentSpool, status: string) => {
    const emptied_at = status === "leer" ? new Date().toISOString() : null;
    const { error } = await supabase.from("filament_spools").update({ status, emptied_at }).eq("id", spool.id);
    if (error) { toast.error("Fehlgeschlagen: " + error.message); return; }
    setSpools(prev => prev.map(s => (s.id === spool.id ? { ...s, status, emptied_at } : s)));
    toast.success(`${spool.spool_code} als ${status} markiert`);
  };

  const confirmDeleteSpool = async () => {
    if (!deleteSpool) return;
    setWorking(true);
    const { error } = await supabase.from("filament_spools").delete().eq("id", deleteSpool.id);
    setWorking(false);
    if (error) { toast.error("Löschen fehlgeschlagen: " + error.message); return; }
    setSpools(prev => prev.filter(s => s.id !== deleteSpool.id));
    toast.success(`Rolle ${deleteSpool.spool_code} gelöscht`);
    setDeleteSpool(null);
  };

  const purgeLeer = async () => {
    setWorking(true);
    const { error } = await supabase.from("filament_spools").delete().eq("status", "leer");
    setWorking(false);
    if (error) { toast.error("Löschen fehlgeschlagen: " + error.message); return; }
    toast.success(`${leerGesamt} leer gemeldete Rolle(n) gelöscht`);
    setSpools(prev => prev.filter(s => s.status !== "leer"));
    setPurgeOpen(false);
  };

  const openKorrektur = (t: FilamentType) => {
    setKorrekturType(t);
    setZielAnzahl(counts[t.id] || 0);
  };

  const applyKorrektur = async () => {
    if (!korrekturType) return;
    const ziel = Math.max(0, Number(zielAnzahl) || 0);
    const vorhanden = spools.filter(s => s.filament_type_id === korrekturType.id && s.status === "voll");
    setWorking(true);
    try {
      if (ziel < vorhanden.length) {
        const weg = vorhanden.slice(0, vorhanden.length - ziel);
        const { error } = await supabase.from("filament_spools").delete().in("id", weg.map(s => s.id));
        if (error) throw error;
        const wegIds = new Set(weg.map(s => s.id));
        setSpools(prev => prev.filter(s => !wegIds.has(s.id)));
        toast.success(`${weg.length} Rolle(n) entfernt – Bestand jetzt ${ziel}`);
      } else if (ziel > vorhanden.length) {
        const start = await nextSpoolNumber();
        const anzahl = ziel - vorhanden.length;
        const rows = Array.from({ length: anzahl }, (_, i) => ({
          spool_code: formatSpoolCode(start + i),
          filament_type_id: korrekturType.id,
          gewicht_g: 1000,
        }));
        const { data, error } = await supabase.from("filament_spools").insert(rows).select();
        if (error) throw error;
        setSpools(prev => [...((data || []) as FilamentSpool[]), ...prev]);
        toast.success(`${anzahl} Rolle(n) erstellt – Bestand jetzt ${ziel}`);
      } else {
        toast.info("Bestand stimmt bereits");
      }
      setKorrekturType(null);
    } catch (e: any) {
      toast.error("Korrektur fehlgeschlagen: " + e.message);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Bestandsübersicht</h1>
          <p className="text-sm text-muted-foreground">Live-Bestand aus dem Filamentlager</p>
        </div>
        <Button
          variant="outline"
          className="text-destructive hover:text-destructive"
          onClick={() => setPurgeOpen(true)}
          disabled={leerGesamt === 0}
        >
          <Trash2 className="w-4 h-4 mr-1.5" /> Alle leer gemeldeten Rollen löschen ({leerGesamt})
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Package className="w-4 h-4" /> Volle Rollen</div>
          <p className="text-3xl font-bold mt-2">{vollGesamt}</p>
        </div>
        <div className={`rounded-xl border p-4 ${unterMinimum > 0 ? "border-destructive/60 bg-destructive/10" : "border-border bg-card"}`}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><AlertTriangle className="w-4 h-4" /> Unter Mindestbestand</div>
          <p className={`text-3xl font-bold mt-2 ${unterMinimum > 0 ? "text-destructive" : ""}`}>{unterMinimum}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Trash2 className="w-4 h-4" /> Diese Woche leer</div>
          <p className="text-3xl font-bold mt-2">{dieseWoche}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Filamentart</th>
              <th className="text-left px-4 py-2 font-medium">Hersteller</th>
              <th className="text-right px-4 py-2 font-medium">Voll</th>
              <th className="text-right px-4 py-2 font-medium">Minimum</th>
              <th className="text-right px-4 py-2 font-medium">Status</th>
              <th className="text-right px-4 py-2 font-medium">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-4 text-muted-foreground">Lädt…</td></tr>
            ) : types.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-4 text-muted-foreground">Noch keine Filamentarten erfasst.</td></tr>
            ) : types.map(t => {
              const voll = counts[t.id] || 0;
              const knapp = voll <= t.mindestbestand;
              return (
                <tr key={t.id} className="border-t border-border">
                  <td className="px-4 py-2">
                    <span className="inline-flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full border border-border" style={{ backgroundColor: t.farbcode || "#888" }} />
                      {t.material} · {t.farbe}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{t.hersteller || "—"}</td>
                  <td className="px-4 py-2 text-right font-medium">{voll}</td>
                  <td className="px-4 py-2 text-right text-muted-foreground">{t.mindestbestand}</td>
                  <td className="px-4 py-2 text-right">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                      knapp ? "bg-destructive/15 text-destructive border-destructive/40" : "bg-success/15 text-success border-success/40"
                    }`}>{knapp ? "nachbestellen" : "ok"}</span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => setDetailType(t)}>
                        <Eye className="w-3.5 h-3.5 mr-1.5" /> Details
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openKorrektur(t)}>
                        <Wrench className="w-3.5 h-3.5 mr-1.5" /> Lagerkorrektur
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-semibold mb-3">Kürzlich leer gemeldet</h2>
        {letzteLeer.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Rollen leer gemeldet.</p>
        ) : (
          <ul className="space-y-2">
            {letzteLeer.map(s => {
              const t = typeMap[s.filament_type_id];
              return (
                <li key={s.id} className="flex items-center justify-between text-sm">
                  <span>
                    <span className="font-mono">{s.spool_code}</span>
                    <span className="text-muted-foreground"> · {t ? `${t.material} ${t.farbe}` : "unbekannt"}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{relativeTime(s.emptied_at!)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Details: alle Rollen einer Filamentart */}
      <Dialog open={!!detailType} onOpenChange={(v) => { if (!v) setDetailType(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Rollen: {detailType ? `${detailType.material} · ${detailType.farbe}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto">
            {detailSpools.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Rollen erfasst.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Code</th>
                    <th className="text-left px-3 py-2 font-medium">Status</th>
                    <th className="text-right px-3 py-2 font-medium">Gewicht</th>
                    <th className="text-left px-3 py-2 font-medium">Erstellt</th>
                    <th className="text-left px-3 py-2 font-medium">Eingelagert</th>
                    <th className="text-right px-3 py-2 font-medium">Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {detailSpools.map(s => (
                    <tr key={s.id} className="border-t border-border">
                      <td className="px-3 py-2 font-mono">{s.spool_code}</td>
                      <td className="px-3 py-2">
                        <select
                          value={s.status}
                          onChange={e => setSpoolStatus(s, e.target.value)}
                          className="h-8 rounded-md border border-border bg-input px-2 text-xs"
                        >
                          <option value="voll">voll</option>
                          <option value="leer">leer</option>
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right">{s.gewicht_g} g</td>
                      <td className="px-3 py-2 text-muted-foreground">{fmtDate(s.created_at)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{fmtDate((s as any).eingelagert_at ?? null)}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={s.status === "leer"}
                            onClick={() => setSpoolStatus(s, "leer")}
                          >
                            Als leer markieren
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteSpool(s)}
                            aria-label="Rolle löschen"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Lagerkorrektur */}
      <Dialog open={!!korrekturType} onOpenChange={(v) => { if (!v) setKorrekturType(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Lagerkorrektur</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {korrekturType ? `${korrekturType.material} · ${korrekturType.farbe}` : ""} – aktuell{" "}
              <strong>{korrekturType ? counts[korrekturType.id] || 0 : 0}</strong> volle Rollen.
            </p>
            <div className="space-y-1.5">
              <Label>Ziel-Anzahl volle Rollen</Label>
              <Input
                type="number"
                min={0}
                value={zielAnzahl}
                onChange={e => setZielAnzahl(parseInt(e.target.value) || 0)}
                className="bg-input border-border"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Es werden automatisch Rollen erstellt oder entfernt, bis die Ziel-Anzahl erreicht ist.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKorrekturType(null)}>Abbrechen</Button>
            <Button onClick={applyKorrektur} disabled={working}>{working ? "Korrigiert…" : "Bestand setzen"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rolle löschen */}
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
              onClick={(e) => { e.preventDefault(); confirmDeleteSpool(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {working ? "Löscht…" : "Löschen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Alle leeren löschen */}
      <AlertDialog open={purgeOpen} onOpenChange={setPurgeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Wirklich löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Alle {leerGesamt} als leer gemeldeten Rollen werden endgültig gelöscht. Volle Rollen bleiben erhalten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); purgeLeer(); }}
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
