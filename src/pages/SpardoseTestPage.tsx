import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import JSZip from "jszip";
import { Download, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useMaterialFarben } from "@/lib/material-farben";
import { DEFAULTS, FONTS, generateSpardose, sanitizeName, type SpardoseParams, type SpardoseResult } from "@/lib/spardose";

// ADMIN-TESTVERSION des Spardose-Generators (nur unter /admin/spardose-test)


function Viewer({ res, colors }: { res: SpardoseResult | null; colors: { text: string; base: string; cap: string } }) {
  const host = useRef<HTMLDivElement>(null);
  const st = useRef<{ scene: THREE.Scene; group: THREE.Group; cam: THREE.PerspectiveCamera; controls: OrbitControls; fitKey: string } | null>(null);

  useEffect(() => {
    const el = host.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
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
    const controls = new OrbitControls(cam, renderer.domElement);
    controls.enableDamping = true;
    st.current = { scene, group, cam, controls, fitKey: "" };
    let raf = 0;
    const loop = () => { controls.update(); renderer.render(scene, cam); raf = requestAnimationFrame(loop); };
    loop();
    const ro = new ResizeObserver(() => {
      cam.aspect = el.clientWidth / el.clientHeight; cam.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    });
    ro.observe(el);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); renderer.dispose(); el.removeChild(renderer.domElement); st.current = null; };
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
    if (s.fitKey !== key) {
      s.fitKey = key;
      const dist = Math.max(res.dims.x * 1.35, 140);
      s.controls.target.set(0, 0, -res.dims.z / 2);
      s.cam.position.set(dist * 0.3, dist * 0.22, dist * 0.95);
      s.controls.update();
    }
  }, [res, colors]);

  return <div ref={host} className="h-full min-h-[360px] w-full" />;
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
      const hell = plaFarben.find((c) => /blau|gelb|rot|orange|gr/i.test(c.name) && c !== dunkel) ?? plaFarben[plaFarben.length - 1];
      return { text: ok(o.text) ? o.text : hell.hex, base: ok(o.base) ? o.base : dunkel.hex, cap: ok(o.cap) ? o.cap : hell.hex };
    });
  }, [plaFarben.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const [res, setRes] = useState<SpardoseResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ms, setMs] = useState<number | null>(null);
  const seq = useRef(0);
  const set = <K extends keyof SpardoseParams>(k: K, v: SpardoseParams[K]) => setP((o) => ({ ...o, [k]: v }));

  useEffect(() => {
    const id = ++seq.current;
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
    }, 450);
    return () => clearTimeout(t);
  }, [p]);

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
        <h1 className="text-xl font-bold">Spardose-Generator <span className="ml-2 rounded bg-amber-500/15 px-2 py-0.5 align-middle text-xs font-semibold text-amber-600">TEST</span></h1>
        <p className="text-sm text-muted-foreground">Name als Spardose: hohler Körper mit Schlitz oben in der Mitte, Buchstaben zum Einlegen, Bajonett-Kappe hinten. Nur im Admin sichtbar.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr_260px]">
        <div className="space-y-4 rounded-xl border bg-card p-4">
          <Field label="Name" value={`${p.name.length}/12`}>
            <Input value={p.name} maxLength={12} onChange={(e) => set("name", sanitizeName(e.target.value))} placeholder="z. B. Nora" />
            <p className="text-[11px] text-muted-foreground">Nur Buchstaben A–Z und Ziffern, keine Sonderzeichen.</p>
          </Field>
          <Field label="Schrift">
            <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={p.font} onChange={(e) => set("font", e.target.value)}>
              {FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </Field>
          <Field label="Buchstabenabstand" value={`${p.spacing.toFixed(1)} mm`}>
            <Slider min={-5} max={10} step={0.5} value={[p.spacing]} onValueChange={([v]) => set("spacing", v)} />
          </Field>
          <Field label="Maximale Länge" value={`${p.maxLength} mm`}>
            <Slider min={100} max={300} step={5} value={[p.maxLength]} onValueChange={([v]) => set("maxLength", v)} />
          </Field>
          <Field label="Rand um die Schrift" value={`${p.rand.toFixed(1)} mm`}>
            <Slider min={3} max={10} step={0.5} value={[p.rand]} onValueChange={([v]) => set("rand", v)} />
            <p className="text-[11px] text-muted-foreground">Abstand von den Buchstaben bis zum Rand der Spardose (min. 3 mm). Mehr Rand = grössere Kappe.</p>
          </Field>
          <Field label="Buchstabenhöhe" value={`${p.size} mm`}>
            <Slider min={25} max={75} step={1} value={[p.size]} onValueChange={([v]) => set("size", v)} />
          </Field>

          <details className="rounded-lg border p-3 text-sm">
            <summary className="cursor-pointer font-medium">Erweitert (Passung &amp; Aufbau)</summary>
            <div className="mt-3 space-y-4">
              <Field label="Tiefe der Dose" value={`${p.tiefe} mm`}><Slider min={25} max={70} step={1} value={[p.tiefe]} onValueChange={([v]) => set("tiefe", v)} /></Field>
              <Field label="Wandstärke" value={`${p.wand.toFixed(1)} mm`}><Slider min={1.6} max={4} step={0.2} value={[p.wand]} onValueChange={([v]) => set("wand", v)} /></Field>
              <Field label="Spiel (Passung)" value={`${p.spiel.toFixed(2)} mm`}><Slider min={0.1} max={0.5} step={0.05} value={[p.spiel]} onValueChange={([v]) => set("spiel", v)} /></Field>
              <Field label="Tiefe der Vertiefung" value={`${p.taschenTiefe.toFixed(1)} mm`}><Slider min={1} max={4} step={0.5} value={[p.taschenTiefe]} onValueChange={([v]) => set("taschenTiefe", v)} /></Field>
              <Field label="Buchstaben stehen vor" value={`${p.ueberstand.toFixed(1)} mm`}><Slider min={0} max={3} step={0.5} value={[p.ueberstand]} onValueChange={([v]) => set("ueberstand", v)} /></Field>
              <Field label="Schlitz Länge" value={`${p.schlitzLaenge} mm`}><Slider min={25} max={40} step={1} value={[p.schlitzLaenge]} onValueChange={([v]) => set("schlitzLaenge", v)} /></Field>
              <Field label="Schlitz Breite" value={`${p.schlitzBreite.toFixed(1)} mm`}><Slider min={2.5} max={5} step={0.1} value={[p.schlitzBreite]} onValueChange={([v]) => set("schlitzBreite", v)} /></Field>
              <div className="flex items-center justify-between"><span className="text-xs font-medium">Rillen (Schichten-Look)</span><Switch checked={p.rillen} onCheckedChange={(v) => set("rillen", v)} /></div>
              {p.rillen && (
                <>
                  <Field label="Rillen-Abstand" value={`${p.rillenAbstand.toFixed(1)} mm`}><Slider min={0.8} max={3} step={0.2} value={[p.rillenAbstand]} onValueChange={([v]) => set("rillenAbstand", v)} /></Field>
                  <Field label="Rillen-Tiefe" value={`${p.rillenTiefe.toFixed(2)} mm`}><Slider min={0.2} max={0.8} step={0.05} value={[p.rillenTiefe]} onValueChange={([v]) => set("rillenTiefe", v)} /></Field>
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
            {!res && !busy && <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">Name eingeben</div>}
          </div>
          {err && <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">Fehler: {err}</div>}
          {res && res.warnings.length > 0 && (
            <div className="space-y-1 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
              {res.warnings.map((w) => <div key={w} className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{w}</div>)}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={download} disabled={!res || busy}><Download className="mr-2 h-4 w-4" />STL herunterladen (ZIP: Körper, Buchstaben, Kappe)</Button>
            <span className="text-xs text-muted-foreground">Körper liegt mit der Vorderseite auf dem Druckbett. Buchstaben mit der flachen Seite nach unten.</span>
          </div>
        </div>

        <div className="space-y-4 rounded-xl border bg-card p-4">
          <Field label="Material"><div className="inline-flex rounded-md bg-primary/10 px-2.5 py-1 text-sm font-semibold text-primary">PLA</div></Field>
          <Field label="Abmessungen">
            <div className="text-sm tabular-nums">
              {res ? <>X {res.dims.x.toFixed(1)} · Y {res.dims.y.toFixed(1)} · Z {res.dims.z.toFixed(1)} mm</> : "–"}
            </div>
            {res && <div className="text-[11px] text-muted-foreground">Berechnet in {ms} ms · Raster {res.info.ppm} px/mm · Kappe Ø {(res.info.capR * 2).toFixed(0)} mm</div>}
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
