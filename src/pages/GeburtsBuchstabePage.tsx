import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import JSZip from "jszip";
import { AlertTriangle, Download, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider as BaseSlider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { DRUCKER } from "@/lib/bubbleLetters";
import {
  BIRTH_LIMITS, DEFAULT_BIRTH, ICON_KINDS, LETTER_FONTS, NAME_FONTS, buildBirth, pathsToD, trianglesToStl,
  type BirthParams, type BirthResult, type IconKind,
} from "@/lib/namensBuchstabe";

const Slider = (props: React.ComponentProps<typeof BaseSlider>) => (
  <BaseSlider {...props} className={cn("[&>span:first-child]:bg-muted [&>span:first-child]:border [&>span:first-child]:border-border", props.className)} />
);

function Field({ label, children, value }: { label: string; children: React.ReactNode; value?: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">{label}</span>
        {value && <span className="tabular-nums text-muted-foreground">{value}</span>}
      </div>
      {children}
    </div>
  );
}

const selectCls = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";
const COLORS = { weiss: "#f4f1ea", gold: "#c9a24d" } as const;

function Viewer({ res, fitKey, resetRef, body, accent }: { res: BirthResult | null; fitKey: string; resetRef: React.MutableRefObject<(() => void) | null>; body: string; accent: string }) {
  const host = useRef<HTMLDivElement>(null);
  const st = useRef<{ group: THREE.Group; cam: THREE.PerspectiveCamera; controls: OrbitControls; fitKey: string; home?: { pos: THREE.Vector3; target: THREE.Vector3 } } | null>(null);

  useEffect(() => {
    const el = host.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(30, el.clientWidth / el.clientHeight, 1, 4000);
    cam.position.set(120, 40, 500);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x777777, 1.3));
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(-150, 220, 260);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xffffff, 0.7);
    fill.position.set(220, -60, 160);
    scene.add(fill);
    const group = new THREE.Group();
    scene.add(group);
    const controls = new OrbitControls(cam, renderer.domElement);
    controls.enableDamping = true;
    controls.zoomToCursor = true;
    controls.screenSpacePanning = true;
    st.current = { group, cam, controls, fitKey: "" };
    resetRef.current = () => {
      const h = st.current?.home;
      if (!h) return;
      cam.position.copy(h.pos);
      controls.target.copy(h.target);
      controls.update();
    };
    let raf = 0;
    const loop = () => { raf = requestAnimationFrame(loop); controls.update(); renderer.render(scene, cam); };
    loop();
    const ro = new ResizeObserver(() => {
      renderer.setSize(el.clientWidth, el.clientHeight);
      cam.aspect = el.clientWidth / el.clientHeight;
      cam.updateProjectionMatrix();
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      group.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
      renderer.dispose();
      el.removeChild(renderer.domElement);
      st.current = null;
    };
  }, [resetRef]);

  useEffect(() => {
    const s = st.current;
    if (!s) return;
    s.group.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
    s.group.clear();
    if (!res) return;
    for (const p of res.parts) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(p.positions, 3));
      g.computeVertexNormals();
      s.group.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: p.color === "gold" ? accent : body, roughness: 0.5, metalness: p.color === "gold" ? 0.15 : 0 })));
    }
    if (s.fitKey !== fitKey) {
      s.fitKey = fitKey;
      const { x0, x1, y0, y1 } = res.bounds;
      const w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const aspect = s.cam.aspect || 1.3;
      const dist = (Math.max(h, w / aspect) / 2 / Math.tan((s.cam.fov * Math.PI) / 360)) * 1.35 + res.depth;
      s.controls.target.set(cx, cy, res.depth / 2);
      s.cam.position.set(cx + dist * 0.35, cy + dist * 0.12, res.depth / 2 + dist * 0.92);
      const gross = Math.max(w, h);
      s.controls.minDistance = Math.max(20, gross * 0.15);
      s.controls.maxDistance = gross * 6;
      s.cam.near = Math.max(1, gross * 0.01);
      s.cam.far = gross * 30;
      s.cam.updateProjectionMatrix();
      s.home = { pos: s.cam.position.clone(), target: s.controls.target.clone() };
      s.controls.update();
    }
  }, [res, fitKey, body, accent]);

  return <div ref={host} className="h-[420px] w-full rounded-xl border bg-gradient-to-b from-muted/40 to-muted/10 sm:h-[600px]" />;
}

function Preview2D({ res, body, accent }: { res: BirthResult; body: string; accent: string }) {
  const { x0, x1, y0, y1 } = res.bounds;
  const pad = 25;
  // Ebenen von unten nach oben (nach z sortiert); y wird gespiegelt
  const layers = [...res.layers].sort((a, b) => a.z - b.z);
  return (
    <div className="h-[420px] w-full rounded-xl border bg-gradient-to-b from-muted/40 to-muted/10 p-3 sm:h-[600px]">
      <svg viewBox={`${x0 - pad} ${-y1 - pad} ${x1 - x0 + 2 * pad} ${y1 - y0 + 2 * pad}`} className="h-full w-full">
        <g transform="scale(1,-1)">
          {layers.map((l) => (
            <path key={l.id} d={pathsToD(l.paths)} fill={l.color === "gold" ? accent : body} stroke="#00000055" strokeWidth={0.35} />
          ))}
        </g>
      </svg>
    </div>
  );
}

function download(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export default function GeburtsBuchstabePage() {
  const [p, setP] = useState<BirthParams>(DEFAULT_BIRTH);
  const [res, setRes] = useState<BirthResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ms, setMs] = useState(0);
  const [mode, setMode] = useState<"3d" | "2d">("3d");
  const [body, setBody] = useState<string>(COLORS.weiss);
  const [accent, setAccent] = useState<string>(COLORS.gold);
  const token = useRef(0);
  const resetRef = useRef<(() => void) | null>(null);
  const set = <K extends keyof BirthParams>(k: K, v: BirthParams[K]) => setP((q) => ({ ...q, [k]: v }));
  const setIcon = (k: IconKind, patch: Partial<BirthParams["icons"][IconKind]>) => setP((q) => ({ ...q, icons: { ...q.icons, [k]: { ...q.icons[k], ...patch } } }));

  useEffect(() => {
    const my = ++token.current;
    setBusy(true);
    const t = setTimeout(async () => {
      const t0 = performance.now();
      try {
        const r = await buildBirth(p);
        if (my !== token.current) return;
        setRes(r);
        setErr(null);
        setMs(Math.round(performance.now() - t0));
      } catch (e) {
        console.error(e);
        if (my === token.current) { setRes(null); setErr(e instanceof Error ? e.message : "Fehler beim Berechnen"); }
      } finally {
        if (my === token.current) setBusy(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [p]);

  const slug = useMemo(() => (`${p.letter}-${p.name}`.replace(/\s+/g, "-").replace(/[^A-Za-z0-9-]/g, "").slice(0, 30) || "buchstabe"), [p.letter, p.name]);
  const letterPart = res?.parts.find((x) => x.id === "buchstabe");
  const passt = letterPart ? DRUCKER.filter((d) => (letterPart.dims.x <= d.x && letterPart.dims.y <= d.y) || (letterPart.dims.x <= d.y && letterPart.dims.y <= d.x)) : [];
  const gramm = (v: number) => (v / 1000) * 1.24;

  const exportOne = (id: string) => {
    const part = res?.parts.find((x) => x.id === id);
    if (part) download(new Blob([trianglesToStl(part.positions)], { type: "model/stl" }), `${slug}-${part.id}.stl`);
  };
  const exportZip = async () => {
    if (!res) return;
    const zip = new JSZip();
    for (const part of res.parts) zip.file(`${slug}-${part.id}.stl`, trianglesToStl(part.positions));
    download(await zip.generateAsync({ type: "blob" }), `${slug}-alle-teile.zip`);
  };

  return (
    <div className="mx-auto max-w-[1280px] space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-bold">Namensbuchstabe <span className="ml-2 rounded bg-primary/10 px-2 py-0.5 align-middle text-xs font-semibold text-primary">NEU</span></h1>
        <p className="text-sm text-muted-foreground">Grosser Anfangsbuchstabe mit Mulde für den Namen und für Icons (Uhrzeit, Datum, Grösse, Gewicht). Name und Icons werden separat gedruckt und eingeklebt. Nur im Admin sichtbar.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
        <div className="order-2 space-y-4 rounded-xl border bg-card p-5 lg:order-1">
          <div className="grid grid-cols-[90px_1fr] gap-3">
            <Field label="Buchstabe">
              <Input value={p.letter} maxLength={1} className="text-center text-lg font-bold uppercase" onChange={(e) => set("letter", e.target.value.toUpperCase().slice(0, 1))} />
            </Field>
            <Field label="Schrift des Buchstabens">
              <select className={selectCls} value={p.letterFont} onChange={(e) => set("letterFont", e.target.value)}>
                {LETTER_FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Höhe des Buchstabens" value={`${p.letterHeight} mm`}>
            <Slider min={BIRTH_LIMITS.letterHeight[0]} max={BIRTH_LIMITS.letterHeight[1]} step={5} value={[p.letterHeight]} onValueChange={([v]) => set("letterHeight", v)} />
          </Field>
          <Field label="Tiefe des Buchstabens" value={`${p.depth} mm`}>
            <Slider min={BIRTH_LIMITS.depth[0]} max={BIRTH_LIMITS.depth[1]} step={1} value={[p.depth]} onValueChange={([v]) => set("depth", v)} />
          </Field>
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <div className="text-sm font-medium">Standplatte</div>
              <div className="text-[11px] text-muted-foreground">Leiste unten, damit auch runde Buchstaben (O, S, C …) sicher stehen.</div>
            </div>
            <Switch checked={p.standplatte} onCheckedChange={(v) => set("standplatte", v)} />
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <div className="text-sm font-semibold">Name</div>
            <Input value={p.name} maxLength={16} placeholder="z. B. Marco" onChange={(e) => set("name", e.target.value)} />
            <select className={selectCls} value={p.nameFont} onChange={(e) => {
              const f = NAME_FONTS.find((x) => x.id === e.target.value);
              setP((q) => ({ ...q, nameFont: e.target.value, nameThick: f ? f.thick : q.nameThick }));
            }}>
              {NAME_FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
            <p className="text-[11px] text-muted-foreground">Nur durchgehend verbundene Schreibschriften, damit der Name ein Stück bleibt.</p>
            <Field label="Breite (% vom Buchstaben)" value={`${p.nameWidth} %`}>
              <Slider min={BIRTH_LIMITS.nameWidth[0]} max={BIRTH_LIMITS.nameWidth[1]} step={1} value={[p.nameWidth]} onValueChange={([v]) => set("nameWidth", v)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Verschieben →" value={`${p.nameX} %`}>
                <Slider min={BIRTH_LIMITS.nameX[0]} max={BIRTH_LIMITS.nameX[1]} step={1} value={[p.nameX]} onValueChange={([v]) => set("nameX", v)} />
              </Field>
              <Field label="Verschieben ↑" value={`${p.nameY} %`}>
                <Slider min={BIRTH_LIMITS.nameY[0]} max={BIRTH_LIMITS.nameY[1]} step={1} value={[p.nameY]} onValueChange={([v]) => set("nameY", v)} />
              </Field>
            </div>
            <Field label="Neigung" value={`${p.nameAngle}°`}>
              <Slider min={BIRTH_LIMITS.nameAngle[0]} max={BIRTH_LIMITS.nameAngle[1]} step={1} value={[p.nameAngle]} onValueChange={([v]) => set("nameAngle", v)} />
            </Field>
            <Field label="Striche verstärken" value={`${p.nameThick.toFixed(1)} mm`}>
              <Slider min={BIRTH_LIMITS.nameThick[0]} max={BIRTH_LIMITS.nameThick[1]} step={0.1} value={[p.nameThick]} onValueChange={([v]) => set("nameThick", v)} />
            </Field>
            <Field label="Dicke des Namens" value={`${p.nameHeightMm} mm`}>
              <Slider min={BIRTH_LIMITS.nameHeightMm[0]} max={BIRTH_LIMITS.nameHeightMm[1]} step={0.5} value={[p.nameHeightMm]} onValueChange={([v]) => set("nameHeightMm", v)} />
            </Field>
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <div className="text-sm font-semibold">Zusatz-Icons</div>
            {ICON_KINDS.map((k) => {
              const ic = p.icons[k.kind];
              return (
                <div key={k.kind} className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Switch checked={ic.enabled} onCheckedChange={(v) => setIcon(k.kind, { enabled: v })} />
                    <span className="w-36 shrink-0 text-sm">{k.label}</span>
                    <Input disabled={!ic.enabled} value={ic.text} placeholder={k.placeholder} maxLength={12} onChange={(e) => setIcon(k.kind, { text: e.target.value })} />
                  </div>
                  {ic.enabled && !p.autoPos && (
                    <div className="grid grid-cols-2 gap-3 pl-12">
                      <Slider min={0} max={100} step={1} value={[ic.x]} onValueChange={([v]) => setIcon(k.kind, { x: v })} aria-label="Position waagrecht" />
                      <Slider min={0} max={100} step={1} value={[ic.y]} onValueChange={([v]) => setIcon(k.kind, { y: v })} aria-label="Position senkrecht" />
                    </div>
                  )}
                </div>
              );
            })}
            <Field label="Icon-Grösse" value={`${p.iconSize} mm`}>
              <Slider min={BIRTH_LIMITS.iconSize[0]} max={BIRTH_LIMITS.iconSize[1]} step={1} value={[p.iconSize]} onValueChange={([v]) => set("iconSize", v)} />
            </Field>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">Automatisch platzieren</div>
                <div className="text-[11px] text-muted-foreground">Sucht freie Stellen auf dem Buchstaben, nahe der Wunschecke. Aus: Position von Hand mit den Reglern.</div>
              </div>
              <Switch checked={p.autoPos} onCheckedChange={(v) => set("autoPos", v)} />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <div className="text-sm font-semibold">Passung</div>
            <Field label="Tiefe der Mulden" value={`${p.pocketDepth} mm`}>
              <Slider min={BIRTH_LIMITS.pocketDepth[0]} max={BIRTH_LIMITS.pocketDepth[1]} step={0.5} value={[p.pocketDepth]} onValueChange={([v]) => set("pocketDepth", v)} />
            </Field>
            <Field label="Spiel rundum" value={`${p.clearance.toFixed(2)} mm`}>
              <Slider min={BIRTH_LIMITS.clearance[0]} max={BIRTH_LIMITS.clearance[1]} step={0.05} value={[p.clearance]} onValueChange={([v]) => set("clearance", v)} />
            </Field>
            <p className="text-[11px] text-muted-foreground">Das Spiel macht die Mulde grösser als das Einlegeteil, damit es sich ohne Nacharbeit einlegen und verkleben lässt.</p>
          </div>

          <Field label="Vorschaufarben">
            <div className="flex items-center gap-3 text-xs">
              <label className="flex items-center gap-1.5">Buchstabe <input type="color" value={body} onChange={(e) => setBody(e.target.value)} className="h-6 w-8 cursor-pointer rounded border bg-transparent p-0" /></label>
              <label className="flex items-center gap-1.5">Name und Icons <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-6 w-8 cursor-pointer rounded border bg-transparent p-0" /></label>
            </div>
          </Field>
          <Button variant="ghost" size="sm" onClick={() => setP(DEFAULT_BIRTH)}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Zurücksetzen</Button>
        </div>

        <div className="order-1 space-y-3 lg:order-2">
          <div className="relative">
            {mode === "3d" || !res
              ? <Viewer res={res} body={body} accent={accent} resetRef={resetRef} fitKey={`${p.letter}|${p.letterFont}|${p.letterHeight}|${p.depth}|${p.standplatte}`} />
              : <Preview2D res={res} body={body} accent={accent} />}
            <div className="absolute left-3 top-3 flex overflow-hidden rounded-full border bg-background/80 text-xs">
              {(["3d", "2d"] as const).map((m) => (
                <button key={m} type="button" onClick={() => setMode(m)} className={cn("px-3 py-1", mode === m ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>{m.toUpperCase()}</button>
              ))}
            </div>
            {mode === "3d" && <button type="button" onClick={() => resetRef.current?.()} className="absolute bottom-3 right-3 rounded-full border bg-background/80 px-2.5 py-1 text-xs hover:bg-background">Ansicht zurücksetzen</button>}
            {busy && <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-background/80 px-2.5 py-1 text-xs"><Loader2 className="h-3.5 w-3.5 animate-spin" />Berechne…</div>}
            {!res && !busy && <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">{err ?? "Bitte einen Buchstaben eingeben."}</div>}
          </div>

          {res && (
            <div className="space-y-3 rounded-xl border bg-card p-4">
              {letterPart && (
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm tabular-nums">
                  <span>Breite <b>{letterPart.dims.x.toFixed(0)}</b> mm</span>
                  <span>Höhe <b>{letterPart.dims.y.toFixed(0)}</b> mm</span>
                  <span>Tiefe <b>{letterPart.dims.z.toFixed(0)}</b> mm</span>
                  <span>Buchstabe ≈ <b>{gramm(letterPart.volume).toFixed(0)}</b> g massiv</span>
                </div>
              )}
              <div className="text-sm">
                {passt.length > 0
                  ? <span>Buchstabe passt flach auf: <b>{passt.map((d) => d.id).join(", ")}</b></span>
                  : <span className="inline-flex items-center gap-1.5 text-destructive"><AlertTriangle className="h-4 w-4" />Buchstabe ist zu gross für alle Drucker: Höhe verkleinern.</span>}
              </div>
              {res.warnings.map((w) => (
                <div key={w} className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{w}</div>
              ))}
              <div className="divide-y rounded-lg border text-sm">
                {res.parts.map((part) => (
                  <div key={part.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{part.label}</div>
                      <div className="text-[11px] text-muted-foreground tabular-nums">
                        {part.dims.x.toFixed(0)} × {part.dims.y.toFixed(0)} × {part.dims.z.toFixed(1)} mm · ≈ {gramm(part.volume).toFixed(1)} g · {part.color === "gold" ? "Zweitfarbe" : "Hauptfarbe"}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => exportOne(part.id)}><Download className="mr-1 h-3.5 w-3.5" />STL</Button>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={exportZip}><Download className="mr-1.5 h-4 w-4" />Alle Teile (ZIP)</Button>
                <span className="text-[11px] text-muted-foreground">Gedruckt wird der Buchstabe auf der flachen Rückseite liegend. Berechnet in {ms} ms.</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
