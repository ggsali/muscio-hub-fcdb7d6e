import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

const URL_ = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/slice-profiles`;

interface SchemaFeld { key: string; label: string; type: "number" | "text" | "bool" | "select"; unit?: string; min?: number; max?: number; options?: string[] }
interface ProfilDetail {
  printer: string; name: string;
  schema: SchemaFeld[];
  base: Record<string, string | number | boolean>;
  overrides: Record<string, string | number | boolean>;
  effective: Record<string, string | number | boolean>;
}
type Manifest = Record<string, { name: string; layer_height?: number; infill?: number }[]>;

async function rufe(body: Record<string, unknown>): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(URL_, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "" },
    body: JSON.stringify(body),
  });
  return res.json().catch(() => ({ error: `Fehler ${res.status}` }));
}

/** Slicer-Presets ansehen und aendern. Aenderungen gelten als Ueberschreibung auf dem Server und wirken bei jedem Slice mit diesem Preset. */
export default function SlicerProfile() {
  const [manifest, setManifest] = useState<Manifest>({});
  const [fehler, setFehler] = useState("");
  const [printer, setPrinter] = useState("");
  const [name, setName] = useState("");
  const [detail, setDetail] = useState<ProfilDetail | null>(null);
  const [edit, setEdit] = useState<Record<string, string | number | boolean>>({});
  const [laedt, setLaedt] = useState(false);
  const [speichert, setSpeichert] = useState(false);

  useEffect(() => {
    void (async () => {
      const d = await rufe({ action: "list" });
      if (d?.error) { setFehler(d.error); return; }
      const raw = (d?.process_presets ?? {}) as Manifest;
      setManifest(raw);
      const erster = Object.keys(raw)[0];
      if (erster) { setPrinter(erster); setName(raw[erster]?.[0]?.name ?? ""); }
    })();
  }, []);

  const laden = useCallback(async () => {
    if (!printer || !name) return;
    setLaedt(true); setFehler(""); setEdit({});
    const d = await rufe({ action: "get", printer, name });
    if (d?.error) { setFehler(d.error); setDetail(null); } else setDetail(d as ProfilDetail);
    setLaedt(false);
  }, [printer, name]);
  useEffect(() => { void laden(); }, [laden]);

  const geaendert = useMemo(() => Object.keys(edit).length, [edit]);
  const wert = (f: SchemaFeld) => (f.key in edit ? edit[f.key] : detail?.effective?.[f.key] ?? "");

  const speichern = async () => {
    if (!detail || geaendert === 0) return;
    setSpeichert(true);
    const d = await rufe({ action: "save", printer, name, overrides: edit });
    setSpeichert(false);
    if (d?.error) toast.error(d.error); else { toast.success("Preset gespeichert, gilt ab dem nächsten Slice"); await laden(); }
  };
  const zuruecksetzen = async (keys: string[] | null) => {
    if (!window.confirm(keys ? "Diesen Wert auf den Standard zurücksetzen?" : "Alle Änderungen an diesem Preset zurücksetzen?")) return;
    const d = await rufe({ action: "reset", printer, name, keys });
    if (d?.error) toast.error(d.error); else { toast.success("Zurückgesetzt"); await laden(); }
  };

  const drucker = Object.keys(manifest);
  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <p className="text-sm font-medium">Slicer-Presets ansehen und ändern</p>
      {fehler && <p className="text-xs text-red-600">{fehler}</p>}
      {drucker.length === 0 && !fehler && <p className="text-xs text-muted-foreground">Presets werden geladen…</p>}
      {drucker.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <select className="h-9 rounded-md border border-border bg-input px-2 text-sm" value={printer} onChange={(e) => { setPrinter(e.target.value); setName(manifest[e.target.value]?.[0]?.name ?? ""); }}>
            {drucker.map((p) => <option key={p} value={p}>{p.toUpperCase()}</option>)}
          </select>
          <select className="h-9 rounded-md border border-border bg-input px-2 text-sm min-w-[14rem]" value={name} onChange={(e) => setName(e.target.value)}>
            {(manifest[printer] ?? []).map((p) => <option key={p.name} value={p.name}>{p.name}{p.infill != null ? ` (${p.infill}% Infill)` : ""}</option>)}
          </select>
        </div>
      )}
      {laedt && <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Lade Preset…</p>}
      {detail && (
        <>
          <table className="w-full text-xs">
            <thead><tr className="text-left text-muted-foreground"><th className="py-1">Einstellung</th><th className="w-40">Wert</th><th>Standard</th><th /></tr></thead>
            <tbody>
              {detail.schema.map((f) => {
                const ueberschrieben = f.key in (detail.overrides ?? {});
                const v = wert(f);
                const set = (nv: string | number | boolean) => setEdit((e) => ({ ...e, [f.key]: nv }));
                return (
                  <tr key={f.key} className={`border-t border-border ${f.key in edit ? "bg-amber-50 dark:bg-amber-950/20" : ""}`}>
                    <td className="py-1">{f.label}{f.unit ? <span className="text-muted-foreground"> ({f.unit})</span> : null}{ueberschrieben && <span className="ml-1 text-[10px] rounded bg-primary/10 text-primary px-1">geändert</span>}</td>
                    <td>
                      {f.type === "bool" ? (
                        <input type="checkbox" checked={Boolean(v)} onChange={(e) => set(e.target.checked)} />
                      ) : f.type === "select" ? (
                        <select className="h-8 w-full rounded-md border border-border bg-input px-1" value={String(v)} onChange={(e) => set(e.target.value)}>
                          {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : f.type === "number" ? (
                        <Input type="number" className="h-8" min={f.min} max={f.max} step="any" value={String(v)} onChange={(e) => set(e.target.value === "" ? "" : Number(e.target.value))} />
                      ) : (
                        <Input className="h-8" value={String(v)} onChange={(e) => set(e.target.value)} />
                      )}
                    </td>
                    <td className="text-muted-foreground">{String(detail.base?.[f.key] ?? "–")}</td>
                    <td>{ueberschrieben && <button type="button" title="Auf Standard zurücksetzen" className="text-muted-foreground hover:text-foreground" onClick={() => zuruecksetzen([f.key])}><RotateCcw className="w-3.5 h-3.5" /></button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex flex-wrap gap-2 items-center">
            <Button size="sm" onClick={speichern} disabled={geaendert === 0 || speichert} className="gap-1">
              {speichert ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Speichern{geaendert > 0 ? ` (${geaendert})` : ""}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEdit({})} disabled={geaendert === 0}>Änderungen verwerfen</Button>
            {Object.keys(detail.overrides ?? {}).length > 0 && <Button size="sm" variant="ghost" onClick={() => zuruecksetzen(null)}>Alles auf Standard</Button>}
          </div>
          <p className="text-[11px] text-muted-foreground">Gespeicherte Änderungen liegen auf dem Slicer-Server und gelten ab dem nächsten Slice mit diesem Preset. Der Kalkulator wählt das Preset über den Namen bei den Qualitätsstufen.</p>
        </>
      )}
    </div>
  );
}
