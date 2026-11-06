import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import JSZip from "jszip";
import { AlertTriangle, Download, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider as BaseSlider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
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

function Viewer({ res, color, fitKey, resetRef }: { res: BubbleResult | null; color: string; fitKey: string; resetRef: React.MutableRefObject<(() => void) | null> }) {
  const host = useRef<HTMLDivElement>(null);
  const st = useRef<{ group: THREE.Group; cam: THREE.PerspectiveCamera; controls: OrbitControls; fitKey: string; mat: THREE.MeshStandardMaterial; home?: { pos: THREE.Vector3; target: THREE.Vector3 } } | null>(null);

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
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0 });
    st.current = { group, cam, controls, fitKey: "", mat };
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
      group.traverse((o) => { if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose(); });
      mat.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
      st.current = null;
    };
  }, []);

  useEffect(() => { if (st.current) st.current.mat.color.set(color); }, [color]);

  useEffect(() => {
    const s = st.current;
    if (!s) return;
    s.group.traverse((o) => { if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose(); });
    s.group.clear();
    if (!res) return;
    const total = res.parts.reduce((n, p) => n + p.index.length, 0);
    const index = new Uint32Array(total);
    let off = 0;
    for (const p of res.parts) { index.set(p.index, off); off += p.index.length; }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(res.positions, 3));
    g.setIndex(new THREE.BufferAttribute(index, 1));
    g.computeVertexNormals();
    s.group.add(new THREE.Mesh(g, s.mat));
    if (s.fitKey !== fitKey) {
      s.fitKey = fitKey;
      const { x, y, z } = res.dims;
      const aspect = s.cam.aspect || 1.5;
      const dist = (Math.max(y, x / aspect) / 2 / Math.tan((s.cam.fov * Math.PI) / 360)) * 1.3 + z;
      s.cam.position.set(0, -dist * 0.25, dist);
      s.controls.target.set(0, 0, z / 4);
      // Zoomgrenzen und Clipping-Ebenen an die Grösse anpassen: sonst verschwindet das Objekt beim Heranzoomen
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

  return <div ref={host} className="h-[420px] w-full rounded-xl border bg-gradient-to-b from-muted/40 to-muted/10 sm:h-[560px]" />;
}

function download(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export default function BubbleLetterPage() {
  const [p, setP] = useState<BubbleParams>(DEFAULTS);
  const [res, setRes] = useState<BubbleResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [ms, setMs] = useState(0);
  const [color, setColor] = useState("#3fb6a8");
  const { farbenFor } = useMaterialFarben();
  const set = <K extends keyof BubbleParams>(k: K, v: BubbleParams[K]) => setP((q) => ({ ...q, [k]: v }));
  const token = useRef(0);
  const resetRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const my = ++token.current;
    setBusy(true);
    const t = setTimeout(async () => {
      const t0 = performance.now();
      try {
        const r = await generateBubble(p);
        if (my !== token.current) return;
        setRes(r);
        setMs(Math.round(performance.now() - t0));
      } catch (e) {
        console.error(e);
        if (my === token.current) setRes(null);
      } finally {
        if (my === token.current) setBusy(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [p]);

  const farben = farbenFor("PLA");
  const slug = useMemo(() => (sanitizeText(p.text).replace(/\s+/g, "-").replace(/[^A-Za-z0-9-]/g, "").slice(0, 24) || "text"), [p.text]);
  const passt = res ? DRUCKER.filter((d) => (res.dims.x <= d.x && res.dims.y <= d.y) || (res.dims.x <= d.y && res.dims.y <= d.x)) : [];
  const gramm = res ? (res.volume / 1000) * 1.24 : 0;

  const exportStl = () => {
    if (!res) return;
    download(new Blob([toBinaryStl(res.positions, res.parts.map((x) => x.index))], { type: "model/stl" }), `bubble-${slug}.stl`);
  };
  const exportZip = async () => {
    if (!res) return;
    const zip = new JSZip();
    res.parts.forEach((part, i) => zip.file(`bubble-${slug}-${String(i + 1).padStart(2, "0")}.stl`, toBinaryStl(res.positions, [part.index])));
    download(await zip.generateAsync({ type: "blob" }), `bubble-${slug}-einzeln.zip`);
  };

  return (
    <div className="mx-auto max-w-[1200px] space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-bold">Bubble-Letter-Generator <span className="ml-2 rounded bg-primary/10 px-2 py-0.5 align-middle text-xs font-semibold text-primary">NEU</span></h1>
        <p className="text-sm text-muted-foreground">Text als prall aufgeblasene 3D-Buchstaben in der Schrift Modak, mit flacher Rückseite zum Drucken. Nur im Admin sichtbar.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[400px_1fr]">
        <div className="order-2 space-y-4 rounded-xl border bg-card p-5 lg:order-1">
          <Field label="Text" value={`${sanitizeText(p.text).replace(/\n/g, "").length} Zeichen`}>
            <Textarea rows={2} value={p.text} onChange={(e) => set("text", sanitizeText(e.target.value))} placeholder="z. B. Nora" />
            <p className="text-[11px] text-muted-foreground">Bis zu 4 Zeilen mit je 20 Zeichen (Enter = neue Zeile). Gross- und Kleinbuchstaben, Zahlen, Umlaute und die gängigen Zeichen.</p>
          </Field>
          <Field label="Buchstabenhöhe" value={`${p.size} mm`}>
            <Slider min={LIMITS.size[0]} max={LIMITS.size[1]} step={1} value={[p.size]} onValueChange={([v]) => set("size", v)} />
          </Field>
          <Field label="Aufblasung" value={`${Math.round(p.aufblas * 100)} %`}>
            <Slider min={LIMITS.aufblas[0]} max={LIMITS.aufblas[1]} step={0.05} value={[p.aufblas]} onValueChange={([v]) => set("aufblas", v)} />
            <p className="text-[11px] text-muted-foreground">100 % = runder Querschnitt wie ein Schlauch (so hoch wie die halbe Strichbreite). Weniger = flacher und druckfreundlicher.</p>
          </Field>
          <Field label="Buchstaben verdicken" value={`${p.fettung.toFixed(1)} mm`}>
            <Slider min={LIMITS.fettung[0]} max={LIMITS.fettung[1]} step={0.5} value={[p.fettung]} onValueChange={([v]) => set("fettung", v)} />
            <p className="text-[11px] text-muted-foreground">Macht die Striche rundum dicker: der typische pralle Bubble-Look.</p>
          </Field>
          <Field label="Ecken abrunden" value={`${p.ecken.toFixed(1)} mm`}>
            <Slider min={LIMITS.ecken[0]} max={LIMITS.ecken[1]} step={0.5} value={[p.ecken]} onValueChange={([v]) => set("ecken", v)} />
          </Field>
          <Field label="Maximale Rundung" value={`${p.radius} mm`}>
            <Slider min={LIMITS.radius[0]} max={LIMITS.radius[1]} step={1} value={[p.radius]} onValueChange={([v]) => set("radius", v)} />
            <p className="text-[11px] text-muted-foreground">Dickste Stelle des Ballons. Breite Flächen werden oben nicht höher und bekommen ein flaches Plateau.</p>
          </Field>
          <Field label="Weichheit" value={`${p.weich.toFixed(1)} mm`}>
            <Slider min={LIMITS.weich[0]} max={LIMITS.weich[1]} step={0.1} value={[p.weich]} onValueChange={([v]) => set("weich", v)} />
          </Field>
          <Field label="Buchstabenabstand" value={`${p.spacing.toFixed(1)} mm`}>
            <Slider min={LIMITS.spacing[0]} max={LIMITS.spacing[1]} step={0.5} value={[p.spacing]} onValueChange={([v]) => set("spacing", v)} />
            <p className="text-[11px] text-muted-foreground">Negativ: Buchstaben überlappen und verschmelzen zu einem Stück.</p>
          </Field>
          {sanitizeText(p.text).includes("\n") && (
            <Field label="Zeilenabstand" value={`${p.lineGap.toFixed(0)} mm`}>
              <Slider min={LIMITS.lineGap[0]} max={LIMITS.lineGap[1]} step={1} value={[p.lineGap]} onValueChange={([v]) => set("lineGap", v)} />
            </Field>
          )}
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <div className="text-sm font-medium">Beidseitig (Ballon)</div>
              <div className="text-[11px] text-muted-foreground">Aus: flache Rückseite, druckfertig auf dem Bett. An: von beiden Seiten gewölbt, muss geteilt oder mit Stützen gedruckt werden.</div>
            </div>
            <Switch checked={p.beidseitig} onCheckedChange={(v) => set("beidseitig", v)} />
          </div>
          <Field label="Vorschaufarbe (PLA)">
            <div className="flex flex-wrap gap-1.5">
              {farben.map((c) => (
                <button key={c.name} type="button" title={c.name} aria-label={c.name} onClick={() => setColor(c.hex)}
                  className={cn("h-6 w-6 rounded-full border border-black/10 transition-transform hover:scale-110", color === c.hex && "ring-2 ring-primary ring-offset-2 ring-offset-background")}
                  style={{ backgroundColor: c.hex }} />
              ))}
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-6 w-8 cursor-pointer rounded border bg-transparent p-0" aria-label="Eigene Farbe" />
            </div>
          </Field>
          <Button variant="ghost" size="sm" onClick={() => setP(DEFAULTS)}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Zurücksetzen</Button>
        </div>

        <div className="order-1 space-y-3 lg:order-2">
          <div className="relative">
            <Viewer res={res} color={color} resetRef={resetRef} fitKey={`${p.text}|${p.size}|${p.lineGap}`} />
            <button type="button" onClick={() => resetRef.current?.()} className="absolute bottom-3 right-3 rounded-full border bg-background/80 px-2.5 py-1 text-xs hover:bg-background">Ansicht zurücksetzen</button>
            {busy && <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-background/80 px-2.5 py-1 text-xs"><Loader2 className="h-3.5 w-3.5 animate-spin" />Berechne…</div>}
            {!res && !busy && <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">Bitte einen Text eingeben.</div>}
          </div>

          {res && (
            <div className="space-y-3 rounded-xl border bg-card p-4">
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm tabular-nums">
                <span>Breite <b>{res.dims.x.toFixed(0)}</b> mm</span>
                <span>Tiefe <b>{res.dims.y.toFixed(0)}</b> mm</span>
                <span>Höhe <b>{res.dims.z.toFixed(1)}</b> mm</span>
                <span>Volumen <b>{(res.volume / 1000).toFixed(1)}</b> cm³</span>
                <span>{res.parts.length} {res.parts.length === 1 ? "Teil" : "Teile"}</span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                Gewicht massiv ≈ {gramm.toFixed(0)} g PLA; mit 2 Wänden und 15 % Füllung grob {(gramm * 0.4).toFixed(0)} g. Berechnet in {ms} ms · {(res.triangles / 1000).toFixed(0)}k Dreiecke · Raster {res.ppm.toFixed(1)} Punkte/mm.
              </div>
              <div className="text-sm">
                {passt.length > 0
                  ? <span>Passt auf: <b>{passt.map((d) => d.id).join(", ")}</b></span>
                  : <span className="inline-flex items-center gap-1.5 text-destructive"><AlertTriangle className="h-4 w-4" />Zu gross für alle Drucker: kleiner wählen oder in Einzelteilen drucken.</span>}
              </div>
              {res.warnings.map((w) => (
                <div key={w} className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{w}</div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button onClick={exportStl}><Download className="mr-1.5 h-4 w-4" />STL herunterladen</Button>
                {res.parts.length > 1 && <Button variant="outline" onClick={exportZip}><Download className="mr-1.5 h-4 w-4" />Einzelne Buchstaben (ZIP)</Button>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
