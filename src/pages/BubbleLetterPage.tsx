import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import JSZip from "jszip";
import { AlertTriangle, ChevronLeft, ChevronRight, Download, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider as BaseSlider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { useMaterialFarben } from "@/lib/material-farben";
import { DEFAULTS, DRUCKER, LIMITS, generateBubble, sanitizeText, toBinaryStl, type BubbleParams, type BubbleResult } from "@/lib/bubbleLetters";

// Regler in den 3DMuscio-Farben (der Standard-Slider nutzt die Sekundärfarbe Orange für die Spur)
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

export type Finish = { id: string; label: string; rough: number; metal: number };
export const FINISHES: Finish[] = [
  { id: "matt", label: "Matt", rough: 0.85, metal: 0 },
  { id: "satin", label: "Seidenmatt", rough: 0.42, metal: 0 },
  { id: "glanz", label: "Glänzend", rough: 0.12, metal: 0 },
  { id: "metall", label: "Metallic", rough: 0.28, metal: 0.65 },
];

function Viewer({ res, colors, finishes, sel, onSelect, fitKey, resetRef }: { res: BubbleResult | null; colors: string[]; finishes: string[]; sel: number; onSelect: (i: number) => void; fitKey: string; resetRef: React.MutableRefObject<(() => void) | null> }) {
  const host = useRef<HTMLDivElement>(null);
  const selRef = useRef(onSelect);
  selRef.current = onSelect;
  const st = useRef<{ group: THREE.Group; cam: THREE.PerspectiveCamera; controls: OrbitControls; fitKey: string; meshes: THREE.Mesh[]; dom: HTMLCanvasElement; home?: { pos: THREE.Vector3; target: THREE.Vector3 } } | null>(null);

  useEffect(() => {
    const el = host.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(35, el.clientWidth / el.clientHeight, 0.5, 4000);
    cam.position.set(0, -60, 260);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(-120, 160, 220);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0xffffff, 0.8);
    rim.position.set(160, -100, 120);
    scene.add(rim);
    const group = new THREE.Group();
    scene.add(group);
    const controls = new OrbitControls(cam, renderer.domElement);
    controls.enableDamping = true;
    controls.zoomToCursor = true;
    controls.screenSpacePanning = true;
    st.current = { group, cam, controls, fitKey: "", meshes: [], dom: renderer.domElement };
    resetRef.current = () => {
      const h = st.current?.home;
      if (!h) return;
      cam.position.copy(h.pos);
      controls.target.copy(h.target);
      controls.update();
    };
    // Klick (ohne Ziehen) auf einen Buchstaben wählt ihn aus
    const ray = new THREE.Raycaster();
    let down: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; };
    const onUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      const r = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), cam);
      const hit = ray.intersectObjects(group.children, false)[0];
      if (hit) selRef.current(hit.object.userData.i as number);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);
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
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      controls.dispose();
      group.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); if (m.material) (m.material as THREE.Material).dispose(); });
      renderer.dispose();
      el.removeChild(renderer.domElement);
      st.current = null;
    };
  }, []);

  // Geometrie: ein Mesh pro Buchstabe (gemeinsame Punkte und Normalen)
  useEffect(() => {
    const s = st.current;
    if (!s) return;
    s.group.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); if (m.material) (m.material as THREE.Material).dispose(); });
    s.group.clear();
    s.meshes = [];
    if (!res) return;
    const total = res.parts.reduce((n, p) => n + p.index.length, 0);
    const all = new Uint32Array(total);
    let off = 0;
    for (const p of res.parts) { all.set(p.index, off); off += p.index.length; }
    const base = new THREE.BufferGeometry();
    base.setAttribute("position", new THREE.BufferAttribute(res.positions, 3));
    base.setIndex(new THREE.BufferAttribute(all, 1));
    base.computeVertexNormals();
    res.parts.forEach((p, i) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", base.getAttribute("position"));
      g.setAttribute("normal", base.getAttribute("normal"));
      g.setIndex(new THREE.BufferAttribute(p.index, 1));
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ roughness: 0.42 }));
      m.userData.i = i;
      s.group.add(m);
      s.meshes.push(m);
    });
    base.dispose();
    if (s.fitKey !== fitKey) {
      s.fitKey = fitKey;
      const { x, y, z } = res.dims;
      const aspect = s.cam.aspect || 1.5;
      const dist = (Math.max(y, x / aspect) / 2 / Math.tan((s.cam.fov * Math.PI) / 360)) * 1.3 + z;
      s.cam.position.set(0, -dist * 0.25, dist);
      s.controls.target.set(0, 0, z / 4);
      const gross = Math.max(x, y, z);
      s.controls.minDistance = Math.max(8, gross * 0.12);
      s.controls.maxDistance = gross * 8;
      s.cam.near = Math.max(0.5, gross * 0.01);
      s.cam.far = gross * 30;
      s.cam.updateProjectionMatrix();
      s.home = { pos: s.cam.position.clone(), target: s.controls.target.clone() };
      s.controls.update();
    }
  }, [res, fitKey]);

  // Farbe, Oberfläche und Auswahl pro Buchstabe
  useEffect(() => {
    const s = st.current;
    if (!s) return;
    s.meshes.forEach((m, i) => {
      const mat = m.material as THREE.MeshStandardMaterial;
      const f = FINISHES.find((x) => x.id === finishes[i]) ?? FINISHES[1];
      mat.color.set(colors[i] ?? "#ffffff");
      mat.roughness = f.rough;
      mat.metalness = f.metal;
      mat.emissive.set(i === sel ? 0x1a1a1a : 0x000000);
    });
  }, [res, colors, finishes, sel]);

  return <div ref={host} className="h-[380px] w-full rounded-xl border bg-gradient-to-b from-muted/40 to-muted/10 sm:h-[520px]" />;
}

function download(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// Richtpreis pro Buchstabe in CHF nach Höhe (Platzhalter, hier anpassen): 10 cm = 4.50, 15 cm = 7.50, dazwischen/darüber linear
export function preisProBuchstabe(hMm: number) {
  return Math.max(3, Math.round((4.5 + (hMm - 100) * 0.06) * 20) / 20);
}
const GROESSEN = [80, 100, 150, 200];

export default function BubbleLetterPage() {
  const [p, setP] = useState<BubbleParams>({ ...DEFAULTS, size: 100 });
  const [res, setRes] = useState<BubbleResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [cols, setCols] = useState<string[]>([]);
  const [fins, setFins] = useState<string[]>([]);
  const [sel, setSel] = useState(0);
  const [tab, setTab] = useState<"farbe" | "textur">("farbe");
  const { farbenFor } = useMaterialFarben();
  const set = <K extends keyof BubbleParams>(k: K, v: BubbleParams[K]) => setP((q) => ({ ...q, [k]: v }));
  const token = useRef(0);
  const resetRef = useRef<(() => void) | null>(null);
  const farben = farbenFor("PLA");
  const std = farben[0]?.hex ?? "#ffffff";

  useEffect(() => {
    const my = ++token.current;
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const r = await generateBubble(p);
        if (my !== token.current) return;
        setRes(r);
      } catch (e) {
        console.error(e);
        if (my === token.current) setRes(null);
      } finally {
        if (my === token.current) setBusy(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [p]);

  const n = res?.parts.length ?? 0;
  const colors = useMemo(() => Array.from({ length: n }, (_, i) => cols[i] ?? std), [cols, n, std]);
  const finishes = useMemo(() => Array.from({ length: n }, (_, i) => fins[i] ?? "satin"), [fins, n]);
  const cur = Math.min(sel, Math.max(0, n - 1));
  const setCol = (hex: string) => setCols(colors.map((c, i) => (i === cur ? hex : c)));
  const setFin = (id: string) => setFins(finishes.map((c, i) => (i === cur ? id : c)));

  const slug = useMemo(() => (sanitizeText(p.text).replace(/\s+/g, "-").replace(/[^A-Za-z0-9-]/g, "").slice(0, 24) || "text"), [p.text]);
  const passt = res ? DRUCKER.filter((d) => (res.dims.x <= d.x && res.dims.y <= d.y) || (res.dims.x <= d.y && res.dims.y <= d.x)) : [];
  const gramm = res ? (res.volume / 1000) * 1.24 : 0;
  const preis = n * preisProBuchstabe(p.size);
  const farbName = (hex: string) => farben.find((f) => f.hex.toLowerCase() === hex.toLowerCase())?.name ?? hex;

  const exportStl = () => {
    if (!res) return;
    download(new Blob([toBinaryStl(res.positions, res.parts.map((x) => x.index))], { type: "model/stl" }), `bubble-${slug}.stl`);
  };
  const exportZip = async () => {
    if (!res) return;
    const zip = new JSZip();
    res.parts.forEach((part, i) => zip.file(`bubble-${slug}-${String(i + 1).padStart(2, "0")}-${part.ch}-${farbName(colors[i]).replace(/[^A-Za-z0-9#]/g, "")}.stl`, toBinaryStl(res.positions, [part.index])));
    download(await zip.generateAsync({ type: "blob" }), `bubble-${slug}-einzeln.zip`);
  };

  return (
    <div className="mx-auto max-w-[1200px] space-y-4 p-4 pb-28 sm:p-6 sm:pb-28">
      <div>
        <h1 className="text-xl font-bold">Bubble-Letter-Konfigurator <span className="ml-2 rounded bg-primary/10 px-2 py-0.5 align-middle text-xs font-semibold text-primary">NEU</span></h1>
        <p className="text-sm text-muted-foreground">Name eingeben, Grösse wählen, jeden Buchstaben einzeln einfärben. Nur im Admin sichtbar.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
        <div className="space-y-3">
          <div className="relative">
            <Viewer res={res} colors={colors} finishes={finishes} sel={cur} onSelect={setSel} resetRef={resetRef} fitKey={`${p.text}|${p.size}|${p.lineGap}`} />
            <button type="button" onClick={() => resetRef.current?.()} className="absolute bottom-3 right-3 rounded-full border bg-background/80 px-2.5 py-1 text-xs hover:bg-background">Ansicht zurücksetzen</button>
            {busy && <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-background/80 px-2.5 py-1 text-xs"><Loader2 className="h-3.5 w-3.5 animate-spin" />Berechne…</div>}
            {!res && !busy && <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">Bitte einen Namen eingeben.</div>}
            {res && <div className="absolute left-3 top-3 rounded-full bg-background/80 px-2.5 py-1 text-xs text-muted-foreground">Buchstabe anklicken, um ihn einzufärben</div>}
          </div>
          {res && (
            <div className="space-y-2 rounded-xl border bg-card p-4 text-sm">
              <div className="flex flex-wrap gap-x-6 gap-y-1 tabular-nums">
                <span>Breite <b>{res.dims.x.toFixed(0)}</b> mm</span>
                <span>Höhe <b>{res.dims.y.toFixed(0)}</b> mm</span>
                <span>Tiefe <b>{res.dims.z.toFixed(1)}</b> mm</span>
                <span>≈ <b>{gramm.toFixed(0)}</b> g massiv</span>
              </div>
              <div>
                {passt.length > 0
                  ? <span>Passt auf: <b>{passt.map((d) => d.id).join(", ")}</b></span>
                  : <span className="inline-flex items-center gap-1.5 text-destructive"><AlertTriangle className="h-4 w-4" />Zu gross für alle Drucker: kleiner wählen oder in Einzelteilen drucken.</span>}
              </div>
              {res.warnings.map((w) => (
                <div key={w} className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{w}</div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6 rounded-xl border bg-card p-5">
          <section className="space-y-2">
            <h2 className="text-xs font-semibold tracking-wide text-muted-foreground">01 · GRÖSSE</h2>
            <div className="flex flex-wrap gap-2">
              {GROESSEN.map((g) => (
                <button key={g} type="button" onClick={() => set("size", g)}
                  className={cn("rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted", p.size === g && "border-primary bg-primary/10 font-semibold text-primary")}>
                  {g / 10} cm hoch
                </button>
              ))}
            </div>
            <Field label="Eigene Höhe" value={`${p.size} mm`}>
              <Slider min={LIMITS.size[0]} max={LIMITS.size[1]} step={1} value={[p.size]} onValueChange={([v]) => set("size", v)} />
            </Field>
          </section>

          <section className="space-y-2">
            <h2 className="flex items-center justify-between text-xs font-semibold tracking-wide text-muted-foreground">
              <span>02 · NAME</span><span className="font-normal">{n} Buchstaben, Preis pro Buchstabe. Leerzeichen gratis.</span>
            </h2>
            <Textarea rows={1} value={p.text} onChange={(e) => set("text", sanitizeText(e.target.value))} placeholder="z. B. Ruben" className="text-base" />
            <p className="text-[11px] text-muted-foreground">Bis zu 4 Zeilen mit je 20 Zeichen (Enter = neue Zeile). Es gibt nur A–Z (Umlaute ohne Punkte).</p>
            {sanitizeText(p.text).includes("\n") && (
              <Field label="Zeilenabstand" value={`${p.lineGap.toFixed(0)} mm`}>
                <Slider min={LIMITS.lineGap[0]} max={LIMITS.lineGap[1]} step={1} value={[p.lineGap]} onValueChange={([v]) => set("lineGap", v)} />
              </Field>
            )}
            <Field label="Buchstabenabstand" value={`${p.spacing.toFixed(1)} mm`}>
              <Slider min={LIMITS.spacing[0]} max={LIMITS.spacing[1]} step={0.5} value={[p.spacing]} onValueChange={([v]) => set("spacing", v)} />
            </Field>
            {res && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {res.parts.map((part, i) => (
                  <button key={i} type="button" onClick={() => setSel(i)} title={farbName(colors[i])}
                    className={cn("grid h-11 w-11 place-items-center rounded-lg border text-lg font-bold transition-colors", i === cur && "ring-2 ring-primary ring-offset-2 ring-offset-background")}
                    style={{ backgroundColor: colors[i], color: lum(colors[i]) > 0.55 ? "#111" : "#fff" }}>
                    {part.ch}
                  </button>
                ))}
              </div>
            )}
          </section>

          {res && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold tracking-wide text-muted-foreground">03 · FARBE &amp; OBERFLÄCHE</h2>
              <div className="flex items-center gap-3 rounded-lg border p-2.5">
                <button type="button" aria-label="Vorheriger Buchstabe" onClick={() => setSel((cur - 1 + n) % n)} className="grid h-9 w-9 place-items-center rounded-full border hover:bg-muted"><ChevronLeft className="h-4 w-4" /></button>
                <div className="grid h-12 w-12 place-items-center rounded-lg border text-2xl font-bold" style={{ backgroundColor: colors[cur], color: lum(colors[cur]) > 0.55 ? "#111" : "#fff" }}>{res.parts[cur].ch}</div>
                <div className="min-w-0 flex-1 text-sm"><div className="font-semibold">Buchstabe {cur + 1} von {n}</div><div className="truncate text-xs text-muted-foreground">{farbName(colors[cur])} · {FINISHES.find((f) => f.id === finishes[cur])?.label}</div></div>
                <button type="button" aria-label="Nächster Buchstabe" onClick={() => setSel((cur + 1) % n)} className="grid h-9 w-9 place-items-center rounded-full border hover:bg-muted"><ChevronRight className="h-4 w-4" /></button>
              </div>
              <div className="grid grid-cols-2 rounded-full border bg-muted/40 p-1 text-sm">
                {(["farbe", "textur"] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setTab(t)} className={cn("rounded-full py-1.5 font-medium transition-colors", tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{t === "farbe" ? "Farbe" : "Oberfläche"}</button>
                ))}
              </div>
              {tab === "farbe" ? (
                <div className="grid grid-cols-5 gap-x-1 gap-y-3">
                  {farben.map((c) => (
                    <button key={c.name} type="button" onClick={() => setCol(c.hex)} className="group flex flex-col items-center gap-1">
                      <span className={cn("h-10 w-10 rounded-full border border-black/10 transition-transform group-hover:scale-105", colors[cur]?.toLowerCase() === c.hex.toLowerCase() && "ring-2 ring-primary ring-offset-2 ring-offset-background")} style={{ backgroundColor: c.hex }} />
                      <span className="w-full truncate text-center text-[10px] text-muted-foreground">{c.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {FINISHES.map((f) => (
                    <button key={f.id} type="button" onClick={() => setFin(f.id)} className={cn("rounded-lg border px-3 py-2.5 text-sm transition-colors hover:bg-muted", finishes[cur] === f.id && "border-primary bg-primary/10 font-semibold text-primary")}>{f.label}</button>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => { setCols(colors.map(() => colors[cur])); setFins(finishes.map(() => finishes[cur])); }}>Auf alle Buchstaben anwenden</Button>
                <Button variant="ghost" size="sm" onClick={() => { setCols([]); setFins([]); setP({ ...DEFAULTS, size: 100 }); }}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Zurücksetzen</Button>
              </div>
              <p className="text-[11px] text-muted-foreground">Die Farbe am Bildschirm ist nur ein Anhaltspunkt, das gedruckte Teil kann vor Ort anders aussehen.</p>
            </section>
          )}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3">
          <div>
            <div className="text-base font-bold tabular-nums">{n} {n === 1 ? "Buchstabe" : "Buchstaben"} · CHF {preis.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">Richtpreis, {preisProBuchstabe(p.size).toFixed(2)} pro Buchstabe ({p.size / 10} cm)</div>
          </div>
          <div className="flex gap-2">
            {n > 1 && <Button variant="outline" onClick={exportZip}><Download className="mr-1.5 h-4 w-4" />ZIP</Button>}
            <Button onClick={exportStl} disabled={!res}><Download className="mr-1.5 h-4 w-4" />STL</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function lum(hex: string) {
  const c = new THREE.Color(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}
