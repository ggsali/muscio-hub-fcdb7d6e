import { useEffect, useRef, useState } from "react";
import { Download, Loader2, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import ModelViewer3D, { type ModelInfo } from "@/components/ModelViewer3D";

// Admin-Testseite: Hi3D (Bild → 3D). Preise laut Hi3D-API-Doku, 1 Credit = 0.02 USD.
const MODELS = [
  { id: "hi3dv3.0|2048quality", label: "v3.0 · 2048 quality", usd: 0.9 },
  { id: "hi3dv3.0|2048master", label: "v3.0 · 2048 master (beste Qualität)", usd: 2.9 },
  { id: "hitem3dv2.1|1536fast", label: "v2.1 · 1536 fast", usd: 0.5 },
  { id: "hitem3dv2.1|1536pro", label: "v2.1 · 1536 pro", usd: 0.9 },
  { id: "hitem3dv1.5|1024", label: "v1.5 · 1024 (günstig)", usd: 0.4 },
  { id: "hitem3dv1.5|512", label: "v1.5 · 512 (sehr günstig)", usd: 0.3 },
];
const FORMATS = [{ id: 3, label: "STL (3D-Druck)", kind: "stl" as const, ext: "stl" }, { id: 2, label: "GLB", kind: "glb" as const, ext: "glb" }];
const FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hi3d-test`;

type State = { phase: "idle" | "busy" | "done" | "err"; msg?: string };

export default function Hi3dTestPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [model, setModel] = useState(MODELS[0].id);
  const [format, setFormat] = useState(3);
  const [face, setFace] = useState(1000000);
  const [geoOnly, setGeoOnly] = useState(true);
  const [st, setSt] = useState<State>({ phase: "idle" });
  const [data, setData] = useState<ArrayBuffer | null>(null);
  const [info, setInfo] = useState<ModelInfo | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const cancel = useRef(false);
  const fmt = FORMATS.find((f) => f.id === format)!;

  useEffect(() => () => { cancel.current = true; }, []);
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const u = URL.createObjectURL(file); setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const auth = async () => {
    const { data: s } = await supabase.auth.getSession();
    return { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "", Authorization: `Bearer ${s.session?.access_token ?? ""}` };
  };
  const call = async (body: Record<string, unknown>) => {
    const r = await fetch(FN, { method: "POST", headers: { ...(await auth()), "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return r;
  };

  const generate = async () => {
    if (!file) return;
    cancel.current = false;
    setData(null); setInfo(null); setTaskId(null);
    setSt({ phase: "busy", msg: "Bild wird hochgeladen …" });
    try {
      const [m, res] = model.split("|");
      const form = new FormData();
      form.append("image", file);
      form.append("request_type", geoOnly ? "1" : "3");
      form.append("model", m); form.append("resolution", res);
      form.append("face", String(face)); form.append("format", String(format));
      const r = await fetch(FN, { method: "POST", headers: await auth(), body: form });
      const j = await r.json();
      if (!j.task_id) throw new Error(j.error || "Task konnte nicht erstellt werden");
      setTaskId(j.task_id);
      const t0 = Date.now();
      for (;;) {
        if (cancel.current) return;
        await new Promise((x) => setTimeout(x, 5000));
        const q = await (await call({ action: "query", task_id: j.task_id })).json();
        if (q.error) throw new Error(q.error);
        setSt({ phase: "busy", msg: `Status: ${q.state} · ${Math.round((Date.now() - t0) / 1000)} s` });
        if (q.state === "success") break;
        if (q.state === "failed") throw new Error(q.msg || "Hi3D meldet: fehlgeschlagen");
        if (Date.now() - t0 > 15 * 60_000) throw new Error("Zeitüberschreitung (15 min)");
      }
      setSt({ phase: "busy", msg: "Modell wird geladen …" });
      const f = await call({ action: "file", task_id: j.task_id });
      const ctype = f.headers.get("content-type") || "";
      if (ctype.includes("application/json")) throw new Error((await f.json()).error || "Download fehlgeschlagen");
      setData(await f.arrayBuffer());
      setSt({ phase: "done" });
    } catch (e) {
      setSt({ phase: "err", msg: e instanceof Error ? e.message : String(e) });
    }
  };

  const download = () => {
    if (!data) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data]));
    a.download = `hi3d-${taskId ?? "modell"}.${fmt.ext}`;
    a.click();
    toast.success("Datei gespeichert");
  };

  const usd = MODELS.find((m) => m.id === model)?.usd ?? 0;
  const sel = "mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold md:text-2xl"><Sparkles className="h-5 w-5 text-primary" />Hi3D-Test <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">TEST</span></h1>
        <p className="mt-1 text-sm text-muted-foreground">Bild hochladen, Hi3D erzeugt ein 3D-Modell. Nur für dich im Admin, nichts davon ist öffentlich.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <div className="space-y-4 rounded-xl border bg-card p-5">
          <div>
            <Label className="text-xs">Bild (PNG, JPG, WebP, max. 20 MB)</Label>
            <label className="mt-1 flex h-40 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed bg-muted/30 text-sm text-muted-foreground hover:bg-muted/50">
              {preview ? <img src={preview} alt="Vorschau" className="h-full w-full object-contain" /> : <span className="flex items-center gap-2"><Upload className="h-4 w-4" />Bild wählen</span>}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            <p className="mt-1 text-[11px] text-muted-foreground">Am besten ein einzelnes Objekt, frei stehend, ruhiger Hintergrund.</p>
          </div>
          <div><Label className="text-xs">Modell / Auflösung</Label>
            <select className={sel} value={model} onChange={(e) => setModel(e.target.value)}>{MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Format</Label>
              <select className={sel} value={format} onChange={(e) => setFormat(Number(e.target.value))}>{FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</select></div>
            <div><Label className="text-xs">Flächen (Dreiecke)</Label>
              <select className={sel} value={face} onChange={(e) => setFace(Number(e.target.value))}>{[200000, 500000, 1000000, 2000000].map((n) => <option key={n} value={n}>{n.toLocaleString("de-CH")}</option>)}</select></div>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={geoOnly} onChange={(e) => setGeoOnly(e.target.checked)} />Nur Geometrie (ohne Textur, für 3D-Druck)</label>
          <Button className="w-full gap-2" onClick={generate} disabled={!file || st.phase === "busy"}>
            {st.phase === "busy" ? <><Loader2 className="h-4 w-4 animate-spin" />{st.msg}</> : <><Sparkles className="h-4 w-4" />Modell erzeugen</>}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">Kosten ca. USD {usd.toFixed(2)} pro Modell (Hi3D-Preisliste, ohne Gewähr).</p>
        </div>
        <div className="space-y-3">
          {st.phase === "err" && <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{st.msg}</div>}
          {st.phase === "idle" && <div className="flex h-[460px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">Hier erscheint das 3D-Modell</div>}
          {st.phase === "busy" && <div className="flex h-[460px] items-center justify-center gap-2 rounded-lg border bg-muted/30 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{st.msg} (dauert meist 1–5 Minuten)</div>}
          {data && st.phase === "done" && (
            <>
              <ModelViewer3D data={data} kind={fmt.kind} onInfo={setInfo} />
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Button onClick={download} variant="outline" className="gap-2"><Download className="h-4 w-4" />{fmt.ext.toUpperCase()} herunterladen</Button>
                {info && <span className="text-muted-foreground">{info.triangles.toLocaleString("de-CH")} Dreiecke · Masse (Modelleinheiten) {info.size.map((v) => v.toFixed(2)).join(" × ")}</span>}
              </div>
              <p className="text-[11px] text-muted-foreground">Die Grösse ist relativ, vor dem Druck im Slicer auf Zielgrösse skalieren. Steht das Modell auf der Seite, hilft «Z-oben (aufrichten)».</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
