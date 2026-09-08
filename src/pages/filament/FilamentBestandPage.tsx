import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Package, AlertTriangle, Trash2 } from "lucide-react";
import { loadTypes, loadSpools, fullCountByType, relativeTime, type FilamentSpool, type FilamentType } from "@/lib/filamentLager";

export default function FilamentBestandPage() {
  const [types, setTypes] = useState<FilamentType[]>([]);
  const [spools, setSpools] = useState<FilamentSpool[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [t, s] = await Promise.all([loadTypes(), loadSpools()]);
        setTypes(t);
        setSpools(s);
      } catch (e: any) {
        toast.error("Laden fehlgeschlagen: " + e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const counts = useMemo(() => fullCountByType(spools), [spools]);
  const vollGesamt = useMemo(() => spools.filter(s => s.status === "voll").length, [spools]);
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

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold">Bestandsübersicht</h1>
        <p className="text-sm text-muted-foreground">Live-Bestand aus dem Filamentlager</p>
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
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-4 text-muted-foreground">Lädt…</td></tr>
            ) : types.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-4 text-muted-foreground">Noch keine Filamentarten erfasst.</td></tr>
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
    </div>
  );
}
