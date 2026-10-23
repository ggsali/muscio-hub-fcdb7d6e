import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import JSZip from "jszip";
import { Download, Loader2, AlertTriangle, Plus, Minus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider as BaseSlider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { buildPlate, PLATE } from "@/lib/spardosePlate";
import { calcUmsatz, loadSettings } from "@/lib/calc";
import { useMaterialFarben } from "@/lib/material-farben";
import { DEFAULTS, FONTS, LIMITS, NAME_MIN, SLOT_LEN, SLOT_THK, generateSpardose, sanitizeName, type SpardoseParams, type SpardoseResult } from "@/lib/spardose";

// Regler in den 3DMuscio-Farben (der Standard-Slider nutzt die Sekundärfarbe Orange für die Spur)
const Slider = (props: React.ComponentProps<typeof BaseSlider>) => (
  <BaseSlider {...props} className={cn("[&>span:first-child]:bg-muted [&>span:first-child]:border [&>span:first-child]:border-border", props.className)} />
);

// ADMIN-TESTVERSION des Spardose-Generators (nur unter /admin/spardose-test)


type ViewName = "front" | "back" | "left" | "right" | "top" | "bottom" | "iso";

function axisLabel(text: string, color: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = color;
  g.font = "bold 40px sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 32, 34);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
  sp.scale.set(0.4, 0.4, 0.4);
  return sp;
}

function Viewer({ res, colors }: { res: SpardoseResult | null; colors: { text: string; base: string; cap: string } }) {
  const host = useRef<HTMLDivElement>(null);
  const st = useRef<{ group: THREE.Group; cam: THREE.PerspectiveCamera; controls: OrbitControls; fitKey: string } | null>(null);

  useEffect(() => {
    const el = host.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.autoClear = false;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(35, el.clientWidth / el.clientHeight, 1, 5000);
    cam.position.set(60, 50, 260);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x555555, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(-120, 160, 220);
    scene.add(sun);
    const group = new THREE.Group();
    group.rotation.y = Math.PI; // Druckrichtung -> Ansicht von vorn
    scene.add(group);

    // CAD-Steuerung: links drehen, Mitte/rechts verschieben, Mausrad zoomt in kleinen Schritten
    const controls = new OrbitControls(cam, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.rotateSpeed = 0.8;
    controls.screenSpacePanning = true;
    controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN };
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    renderer.domElement.style.touchAction = "none";
    const onWheel = (e: WheelEvent) => {
      // Ein Rasten des Mausrads = ca. 8 % (statt eines grossen Sprungs); Trackpads zoomen fein
      e.preventDefault();
      e.stopPropagation();
      const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
      const f = Math.exp(Math.max(-120, Math.min(120, dy)) * 0.0007);
      const v = cam.position.clone().sub(controls.target);
      const len = Math.min(controls.maxDistance, Math.max(controls.minDistance, v.length() * f));
      cam.position.copy(controls.target).add(v.setLength(len));
    };
    controls.enableZoom = false; // eigener, sanfter Zoom
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false, capture: true });

    // Orientierungs-Würfel-Ersatz: Achsenkreuz unten rechts (X rot = Breite, Y grün = Höhe, Z blau = Tiefe)
    const gScene = new THREE.Scene();
    gScene.add(new THREE.AxesHelper(0.75));
    const lx = axisLabel("X", "#ef4444"), ly = axisLabel("Y", "#16a34a"), lz = axisLabel("Z", "#2563eb");
    lx.position.set(0.98, 0, 0); ly.position.set(0, 0.98, 0); lz.position.set(0, 0, 0.98);
    gScene.add(lx, ly, lz);
    const gCam = new THREE.PerspectiveCamera(35, 1, 0.1, 20);

    st.current = { group, cam, controls, fitKey: "" };
    let raf = 0;
    const GS = 96;
    const loop = () => {
      controls.update();
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, w, h);
      renderer.clear();
      renderer.render(scene, cam);
      renderer.clearDepth();
      renderer.setScissorTest(true);
      renderer.setViewport(w - GS - 8, 8, GS, GS);
      renderer.setScissor(w - GS - 8, 8, GS, GS);
      gCam.position.copy(cam.position).sub(controls.target).setLength(3.8);
      gCam.quaternion.copy(cam.quaternion);
      renderer.render(gScene, gCam);
      renderer.setScissorTest(false);
      raf = requestAnimationFrame(loop);
    };
    loop();
    const ro = new ResizeObserver(() => {
      cam.aspect = el.clientWidth / el.clientHeight; cam.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); controls.dispose();
      renderer.domElement.removeEventListener("wheel", onWheel, { capture: true });
      renderer.dispose(); el.removeChild(renderer.domElement); st.current = null;
    };
  }, []);

  useEffect(() => {
    const s = st.current;
    if (!s) return;
    s.group.children.slice().forEach((c) => { s.group.remove(c); (c as THREE.Mesh).material && ((c as THREE.Mesh).material as THREE.Material).dispose(); });
    if (!res) return;
    const mk = (g: THREE.BufferGeometry, color: string) => new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.02 }));
    s.group.add(mk(res.body, colors.base));
    s.group.add(mk(res.letters, colors.text));
    const cap = mk(res.cap, colors.cap);
    cap.position.set(res.capPose.x, res.capPose.y, res.capPose.z);
    cap.rotation.z = Math.PI / 2;
    s.group.add(cap);
    const key = `${res.name}|${res.dims.x.toFixed(0)}`;
    s.controls.minDistance = Math.max(res.dims.x * 0.25, 40);
    s.controls.maxDistance = res.dims.x * 4;
    if (s.fitKey !== key) {
      s.fitKey = key;
      setView("iso", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [res, colors]);

  // Standardansichten wie im CAD (Blick auf die Mitte der Dose, Drehpunkt = Mitte)
  const setView = (name: ViewName, fit = false) => {
    const s = st.current;
    if (!s || !res) return;
    const t = new THREE.Vector3(0, 0, -res.dims.z / 2);
    const base = Math.max(res.dims.x * 1.35, 140);
    const len = fit ? base : Math.min(s.controls.maxDistance, Math.max(s.controls.minDistance, s.cam.position.distanceTo(s.controls.target)));
    const dir: Record<ViewName, [number, number, number]> = {
      front: [0, 0, 1], back: [0, 0, -1], left: [1, 0, 0], right: [-1, 0, 0], top: [0, 1, 0.0001], bottom: [0, -1, 0.0001], iso: [0.45, 0.35, 0.82],
    };
    const d = new THREE.Vector3(...dir[name]).normalize();
    s.controls.target.copy(t);
    s.cam.position.copy(t).add(d.multiplyScalar(len));
    s.controls.update();
  };
  const zoom = (f: number) => {
    const s = st.current;
    if (!s) return;
    const v = s.cam.position.clone().sub(s.controls.target);
    const len = Math.min(s.controls.maxDistance, Math.max(s.controls.minDistance, v.length() * f));
    s.cam.position.copy(s.controls.target).add(v.setLength(len));
    s.controls.update();
  };
  const btn = "flex h-8 items-center justify-center rounded-md border bg-background/90 px-2 text-xs font-medium shadow-sm transition-colors hover:bg-accent";
  return (
    <div className="relative h-full min-h-[360px] w-full" onDoubleClick={() => setView("iso", true)}>
      <div ref={host} className="h-full w-full" />
      <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
        {([["front", "Vorne"], ["back", "Hinten"], ["left", "Links"], ["right", "Rechts"], ["top", "Oben"], ["bottom", "Unten"], ["iso", "Iso"]] as [ViewName, string][]).map(([k, l]) => (
          <button key={k} type="button" className={btn} onClick={() => setView(k)}>{l}</button>
        ))}
      </div>
      <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
        <button type="button" className={btn} onClick={() => zoom(0.85)} aria-label="Hineinzoomen"><Plus className="h-4 w-4" /></button>
        <button type="button" className={btn} onClick={() => zoom(1.18)} aria-label="Herauszoomen"><Minus className="h-4 w-4" /></button>
        <button type="button" className={btn} onClick={() => setView("iso", true)} aria-label="Ansicht zurücksetzen"><RotateCcw className="h-4 w-4" /></button>
        <span className="ml-2 hidden text-[11px] text-muted-foreground sm:inline">Links ziehen: drehen · Mitte/Rechts ziehen: verschieben · Doppelklick: zurücksetzen</span>
      </div>
    </div>
  );
}

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

function Swatches({ colors, value, onChange }: { colors: { name: string; hex: string }[]; value: string; onChange: (hex: string) => void }) {
  if (colors.length === 0) return <p className="text-[11px] text-muted-foreground">Keine PLA-Farben in der Bibliothek.</p>;
  const sel = colors.find((c) => c.hex === value);
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {colors.map((c) => (
          <button
            key={c.name}
            type="button"
            title={c.name}
            aria-label={c.name}
            onClick={() => onChange(c.hex)}
            className={cn("h-6 w-6 rounded-full border border-black/10 transition-transform hover:scale-110", value === c.hex && "ring-2 ring-primary ring-offset-2 ring-offset-background")}
            style={{ backgroundColor: c.hex }}
          />
        ))}
      </div>
      {sel && <div className="text-[11px] text-muted-foreground">{sel.name}</div>}
    </div>
  );
}

export default function SpardoseTestPage() {
  const [p, setP] = useState<SpardoseParams>(DEFAULTS);
  const { farbenFor } = useMaterialFarben();
  const plaFarben = farbenFor("PLA");
  const [colors, setColors] = useState({ text: "#0ea5e9", base: "#374151", cap: "#0ea5e9" });
  useEffect(() => {
    // Standardfarben aus der Bibliothek, sobald sie geladen ist (nur PLA)
    if (plaFarben.length === 0) return;
    setColors((o) => {
      const ok = (h: string) => plaFarben.some((c) => c.hex === h);
      const dunkel = plaFarben.find((c) => /schwarz|grau|dunkel/i.test(c.name)) ?? plaFarben[0];
      const hell = plaFarben.find((c) => /blau|gelb|rot|gr/i.test(c.name) && c !== dunkel) ?? plaFarben[plaFarben.length - 1];
      return { text: ok(o.text) ? o.text : hell.hex, base: ok(o.base) ? o.base : dunkel.hex, cap: ok(o.cap) ? o.cap : hell.hex };
    });
  }, [plaFarben.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const [res, setRes] = useState<SpardoseResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ms, setMs] = useState<number | null>(null);
  const seq = useRef(0);
  const prevP = useRef<SpardoseParams>(DEFAULTS);
  const set = <K extends keyof SpardoseParams>(k: K, v: SpardoseParams[K]) => setP((o) => ({ ...o, [k]: v }));

  useEffect(() => {
    const id = ++seq.current;
    // Nur die Schlitzposition geändert -> fast sofort neu berechnen (Zwischenergebnisse sind gespeichert)
    const onlySlot = (Object.keys(p) as (keyof SpardoseParams)[]).every((k) => k === "schlitzX" || p[k] === prevP.current[k]);
    prevP.current = p;
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const t0 = performance.now();
        const r = await generateSpardose(p);
        if (id !== seq.current) { r?.body.dispose(); r?.letters.dispose(); r?.cap.dispose(); return; }
        setRes((old) => { old?.body.dispose(); old?.letters.dispose(); old?.cap.dispose(); return r; });
        setMs(Math.round(performance.now() - t0));
        setErr(null);
      } catch (e) {
        if (id === seq.current) setErr(e instanceof Error ? e.message : String(e));
        console.error(e);
      } finally {
        if (id === seq.current) setBusy(false);
      }
    }, onlySlot ? 40 : 450);
    return () => clearTimeout(t);
  }, [p]);

  const [fin, setFin] = useState<{ state: "idle" | "busy" | "ok" | "err"; msg?: string; min?: number; g?: number; preis?: number; info?: string }>({ state: "idle" });
  useEffect(() => { setFin({ state: "idle" }); }, [res]);

  const fertig = async () => {
    if (!res) return;
    setFin({ state: "busy" });
    try {
      const plate = buildPlate(res);
      if (!plate.fits) { setFin({ state: "err", msg: `Die Teile passen nicht auf die Platte (${PLATE.x}×${PLATE.y} mm). ${plate.info}` }); return; }
      const body = new FormData();
      body.append("file", new File([plate.blob], "spardose-platte.stl"));
      body.append("plate", "1");
      body.append("quality", "0.20");
      body.append("infill", "15");
      const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/slice-public`, {
        method: "POST",
        headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "" },
        body,
        signal: AbortSignal.timeout(110_000),
      });
      const j = await r.json().catch(() => ({}));
      const st = j?.stats;
      if (!st || !(st.filament_g > 0) || !(st.print_time_s > 0)) {
        setFin({ state: "err", msg: `Slicer: ${j?.detail || j?.error || "keine Antwort"}${j?.enabled === false ? " (NAS-Slicing ist in den Einstellungen ausgeschaltet)" : ""}` });
        return;
      }
      const s = await loadSettings();
      const h = st.print_time_s / 3600;
      const preis = Math.round(calcUmsatz(s, st.filament_g, h, 0.5, 0) * 20) / 20;
      setFin({ state: "ok", min: st.print_time_s / 60, g: st.filament_g, preis, info: plate.info });
    } catch (e) {
      setFin({ state: "err", msg: e instanceof Error ? e.message : String(e) });
    }
  };

  const download = async () => {
    if (!res) return;
    const ex = new STLExporter();
    const stl = (g: THREE.BufferGeometry) => ex.parse(new THREE.Mesh(g), { binary: true }) as unknown as DataView;
    const letters = res.letters.clone();
    letters.rotateX(Math.PI); // flache Rückseite nach unten
    letters.computeBoundingBox();
    letters.translate(0, 0, -letters.boundingBox!.min.z);
    const zip = new JSZip();
    const base = `spardose-${res.name.replace(/\s+/g, "_")}`;
    zip.file(`${base}-koerper.stl`, stl(res.body).buffer as ArrayBuffer);
    zip.file(`${base}-buchstaben.stl`, stl(letters).buffer as ArrayBuffer);
    zip.file(`${base}-kappe.stl`, stl(res.cap).buffer as ArrayBuffer);
    letters.dispose();
    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${base}.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-bold">Spardose-Generator <span className="ml-2 rounded bg-primary/10 px-2 py-0.5 align-middle text-xs font-semibold text-primary">TEST</span></h1>
        <p className="text-sm text-muted-foreground">Name als Spardose: hohler Körper mit Münzschlitz oben in der Mitte (längs in der Tiefe), Buchstaben zum Einlegen, Bajonett-Kappe hinten. Nur im Admin sichtbar.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr_260px]">
        <div className="space-y-4 rounded-xl border bg-card p-4">
          <Field label="Name" value={`${p.name.length}/12`}>
            <Input value={p.name} maxLength={12} onChange={(e) => set("name", sanitizeName(e.target.value))} placeholder="z. B. Nora" />
            <p className="text-[11px] text-muted-foreground">Mindestens 2 Zeichen: Buchstaben A–Z und Ziffern, ohne Sonderzeichen und Leerzeichen.</p>
          </Field>
          <Field label="Schrift">
            <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={p.font} onChange={(e) => set("font", e.target.value)}>
              {FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </Field>
          <Field label="Buchstabenabstand" value={`${p.spacing.toFixed(1)} mm`}>
            <Slider min={LIMITS.spacing[0]} max={LIMITS.spacing[1]} step={0.5} value={[p.spacing]} onValueChange={([v]) => set("spacing", v)} />
          </Field>
          <Field label="Maximale Länge" value={`${p.maxLength} mm`}>
            <Slider min={LIMITS.maxLength[0]} max={LIMITS.maxLength[1]} step={5} value={[p.maxLength]} onValueChange={([v]) => set("maxLength", v)} />
          </Field>
          <Field label="Schlitzposition" value={p.schlitzX === 0 ? "Mitte" : `${p.schlitzX > 0 ? "+" : ""}${p.schlitzX} mm`}>
            <Slider min={LIMITS.schlitzX[0]} max={LIMITS.schlitzX[1]} step={1} value={[p.schlitzX]} onValueChange={([v]) => set("schlitzX", v)} />
            <p className="text-[11px] text-muted-foreground">Verschiebt den Münzschlitz nach links oder rechts. Liegt unter der Stelle kein Hohlraum, rutscht er automatisch zur nächsten passenden Stelle.</p>
          </Field>
          <Field label="Rand um die Schrift" value={`${p.rand.toFixed(1)} mm`}>
            <Slider min={LIMITS.rand[0]} max={LIMITS.rand[1]} step={0.5} value={[p.rand]} onValueChange={([v]) => set("rand", v)} />
            <p className="text-[11px] text-muted-foreground">Abstand von den Buchstaben bis zum Rand der Spardose (min. 3 mm). Wird automatisch erhöht, falls die Dose sonst nicht funktioniert.</p>
          </Field>
          <Field label="Buchstabenhöhe" value={`${p.size} mm`}>
            <Slider min={LIMITS.size[0]} max={LIMITS.size[1]} step={1} value={[p.size]} onValueChange={([v]) => set("size", v)} />
          </Field>

          <details className="rounded-lg border p-3 text-sm">
            <summary className="cursor-pointer font-medium">Erweitert (Passung &amp; Aufbau)</summary>
            <div className="mt-3 space-y-4">
              <Field label="Tiefe der Dose (mind. nach Schlitz)" value={`${p.tiefe} mm`}><Slider min={LIMITS.tiefe[0]} max={LIMITS.tiefe[1]} step={1} value={[p.tiefe]} onValueChange={([v]) => set("tiefe", v)} /></Field>
              <Field label="Wandstärke" value={`${p.wand.toFixed(1)} mm`}><Slider min={LIMITS.wand[0]} max={LIMITS.wand[1]} step={0.2} value={[p.wand]} onValueChange={([v]) => set("wand", v)} /></Field>
              <Field label="Spiel (Passung)" value={`${p.spiel.toFixed(2)} mm`}><Slider min={LIMITS.spiel[0]} max={LIMITS.spiel[1]} step={0.05} value={[p.spiel]} onValueChange={([v]) => set("spiel", v)} /></Field>
              <Field label="Tiefe der Vertiefung" value={`${p.taschenTiefe.toFixed(1)} mm`}><Slider min={LIMITS.taschenTiefe[0]} max={LIMITS.taschenTiefe[1]} step={0.5} value={[p.taschenTiefe]} onValueChange={([v]) => set("taschenTiefe", v)} /></Field>
              <Field label="Buchstaben stehen vor" value={`${p.ueberstand.toFixed(1)} mm`}><Slider min={LIMITS.ueberstand[0]} max={LIMITS.ueberstand[1]} step={0.5} value={[p.ueberstand]} onValueChange={([v]) => set("ueberstand", v)} /></Field>
              <div className="flex items-center justify-between"><span className="text-xs font-medium">Rillen (Schichten-Look)</span><Switch checked={p.rillen} onCheckedChange={(v) => set("rillen", v)} /></div>
              {p.rillen && (
                <>
                  <Field label="Rillen-Abstand" value={`${p.rillenAbstand.toFixed(1)} mm`}><Slider min={LIMITS.rillenAbstand[0]} max={LIMITS.rillenAbstand[1]} step={0.2} value={[p.rillenAbstand]} onValueChange={([v]) => set("rillenAbstand", v)} /></Field>
                  <Field label="Rillen-Tiefe" value={`${p.rillenTiefe.toFixed(2)} mm`}><Slider min={LIMITS.rillenTiefe[0]} max={LIMITS.rillenTiefe[1]} step={0.05} value={[p.rillenTiefe]} onValueChange={([v]) => set("rillenTiefe", v)} /></Field>
                </>
              )}
              <Button variant="outline" size="sm" onClick={() => setP({ ...DEFAULTS, name: p.name, font: p.font })}>Auf Standard zurücksetzen</Button>
            </div>
          </details>
        </div>

        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-xl border bg-gradient-to-b from-muted/40 to-muted">
            <div className="h-[460px]"><Viewer res={res} colors={colors} /></div>
            {busy && (
              <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1 text-xs shadow">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> berechne…
              </div>
            )}
            {!res && !busy && <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">Name mit mindestens {NAME_MIN} Zeichen eingeben</div>}
          </div>
          {err && <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">Fehler: {err}</div>}
          {res && res.warnings.length > 0 && (
            <div className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-foreground">
              {res.warnings.map((w) => <div key={w} className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />{w}</div>)}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={download} disabled={!res || busy || !res.valid}><Download className="mr-2 h-4 w-4" />STL herunterladen (ZIP: Körper, Buchstaben, Kappe)</Button>
            <Button variant="secondary" onClick={fertig} disabled={!res || busy || !res.valid || fin.state === "busy"}>
              {fin.state === "busy" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Fertig – Preis berechnen
            </Button>
            <span className="text-xs text-muted-foreground">Körper liegt mit der Vorderseite auf dem Druckbett. Buchstaben mit der flachen Seite nach unten.</span>
          </div>
          {fin.state === "busy" && <div className="rounded-lg border bg-muted/40 p-3 text-sm">Teile werden auf einer Platte angeordnet und auf dem NAS gesliced … (kann bis zu 2 Minuten dauern)</div>}
          {fin.state === "err" && <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{fin.msg}</div>}
          {fin.state === "ok" && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div className="text-2xl font-bold tabular-nums">CHF {fin.preis!.toFixed(2)}</div>
              <div className="mt-1 text-sm text-muted-foreground">Druckzeit {Math.floor(fin.min! / 60)} h {Math.round(fin.min! % 60)} min · Filament {fin.g!.toFixed(0)} g · 1 Platte ({PLATE.x}×{PLATE.y} mm)</div>
              <div className="mt-1 text-[11px] text-muted-foreground">{fin.info}. Richtpreis aus den Kalkulations-Einstellungen (inkl. 0.5 h Nachbearbeitung), PLA, 0.20 mm, 15 % Füllung.</div>
            </div>
          )}
        </div>

        <div className="space-y-4 rounded-xl border bg-card p-4">
          <Field label="Münzschlitz (fest)">
            <div className="text-sm tabular-nums">{SLOT_LEN} × {SLOT_THK} mm</div>
            <div className="text-[11px] text-muted-foreground">Passt für das 5-Franken-Stück (Ø 31,45 × 2,35 mm) plus je 1 mm Spiel.</div>
          </Field>
          <Field label="Material"><div className="inline-flex rounded-md bg-primary/10 px-2.5 py-1 text-sm font-semibold text-primary">PLA</div></Field>
          <Field label="Abmessungen">
            <div className="text-sm tabular-nums">
              {res ? <>X {res.dims.x.toFixed(1)} · Y {res.dims.y.toFixed(1)} · Z {res.dims.z.toFixed(1)} mm</> : "–"}
            </div>
            {res && <div className="text-[11px] text-muted-foreground">Berechnet in {ms} ms · Raster {res.info.ppm} px/mm · Kappe Ø {(res.info.capR * 2).toFixed(0)} mm · Rand {res.info.randUsed} mm</div>}
          </Field>
          <Field label="Buchstaben (Farbe)"><Swatches colors={plaFarben} value={colors.text} onChange={(c) => setColors((o) => ({ ...o, text: c }))} /></Field>
          <Field label="Körper (Farbe)"><Swatches colors={plaFarben} value={colors.base} onChange={(c) => setColors((o) => ({ ...o, base: c }))} /></Field>
          <Field label="Kappe (Farbe)"><Swatches colors={plaFarben} value={colors.cap} onChange={(c) => setColors((o) => ({ ...o, cap: c }))} /></Field>
          <p className="text-[11px] text-muted-foreground">Es stehen nur PLA-Farben aus deiner Filament-Bibliothek zur Auswahl.</p>
        </div>
      </div>
    </div>
  );
}
