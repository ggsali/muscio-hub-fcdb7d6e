import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import JSZip from "jszip";
import { AlertTriangle, CheckCircle2, Crosshair, Download, Eye, Loader2, Package, RotateCcw, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider as BaseSlider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { useMaterialFarben } from "@/lib/material-farben";
import { DEFAULT_PLACE, engrave, faceRegion, overlayGeometry, prepareImage, safeName, to3mf, toStl, type EngraveResult, type FaceInfo, type Place, type Prepared, type RasterIn } from "@/lib/gravur";

const Slider = (props: React.ComponentProps<typeof BaseSlider>) => (
  <BaseSlider {...props} className={cn("[&>span:first-child]:bg-muted [&>span:first-child]:border [&>span:first-child]:border-border", props.className)} />
);

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h2 className="text-xs font-semibold tracking-wide text-muted-foreground">{String(n).padStart(2, "0")} · {title}</h2>
      {children}
    </section>
  );
}

function Num({ label, unit, value, min, max, step, onChange }: { label: string; unit: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="flex items-center gap-1">
          <input type="number" value={Number.isFinite(value) ? +value.toFixed(2) : 0} step={step} onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            className="h-6 w-16 rounded border bg-background px-1.5 text-right tabular-nums" />
          <span className="text-muted-foreground">{unit}</span>
        </span>
      </div>
      <Slider min={min} max={max} step={step} value={[Math.min(max, Math.max(min, value))]} onValueChange={([v]) => onChange(v)} />
    </div>
  );
}

/* ---------- Dateien lesen ---------- */

function geometryFromFile(name: string, buf: ArrayBuffer): THREE.BufferGeometry {
  let geo: THREE.BufferGeometry;
  if (/\.obj$/i.test(name)) {
    const obj = new OBJLoader().parse(new TextDecoder().decode(buf));
    const parts: Float32Array[] = [];
    obj.updateMatrixWorld(true);
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()) as THREE.BufferGeometry;
      g.applyMatrix4(m.matrixWorld);
      parts.push(Float32Array.from(g.getAttribute("position").array as ArrayLike<number>));
    });
    const n = parts.reduce((a, p) => a + p.length, 0);
    const all = new Float32Array(n);
    let o = 0;
    for (const p of parts) { all.set(p, o); o += p.length; }
    geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(all, 3));
  } else {
    geo = new STLLoader().parse(buf);
  }
  if (geo.index) geo = geo.toNonIndexed();
  for (const k of Object.keys(geo.attributes)) if (k !== "position") geo.deleteAttribute(k);
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  if (!geo.getAttribute("position") || geo.getAttribute("position").count < 3) throw new Error("Keine Dreiecke in der Datei gefunden.");
  return geo;
}

async function rasterFromFile(file: File, maxSide = 2000): Promise<RasterIn> {
  const bmp = await createImageBitmap(file);
  const big = Math.max(bmp.width, bmp.height);
  // kleine Bilder hochrechnen (glättet die Pixelstufen), grosse begrenzen
  const k = big < 1600 ? 1600 / big : Math.min(1, maxSide / big);
  const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const d = ctx.getImageData(0, 0, w, h);
  return { data: d.data, width: w, height: h };
}

/* ---------- 3D-Ansicht ---------- */

type ViewProps = {
  model: THREE.BufferGeometry | null;
  face: FaceInfo | null;
  overlay: THREE.BufferGeometry | null;
  result: EngraveResult | null;
  showResult: boolean;
  colModell: string;
  colEinlage: string;
  showModell: boolean;
  showEinlage: boolean;
  pick: boolean;
  place: Place;
  onPick: (tri: number) => void;
  onMove: (dx: number, dy: number) => void;
  api: React.MutableRefObject<{ lookAtFace: () => void; fit: () => void } | null>;
};

function Viewer(props: ViewProps) {
  const host = useRef<HTMLDivElement>(null);
  const P = useRef(props);
  P.current = props;
  const S = useRef<{
    scene: THREE.Scene; cam: THREE.PerspectiveCamera; controls: OrbitControls;
    model: THREE.Mesh | null; hi: THREE.Mesh | null; ov: THREE.Mesh | null; res: THREE.Group;
    matModel: THREE.MeshStandardMaterial; matHi: THREE.MeshBasicMaterial; matOv: THREE.MeshBasicMaterial; matIns: THREE.MeshStandardMaterial; matResModell: THREE.MeshStandardMaterial;
  } | null>(null);

  useEffect(() => {
    const el = host.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(35, el.clientWidth / el.clientHeight, 0.5, 5000);
    cam.up.set(0, 0, 1);
    cam.position.set(0, -200, 140);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(-150, -200, 300);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0xffffff, 0.8);
    rim.position.set(200, 150, 100);
    scene.add(rim);
    const controls = new OrbitControls(cam, renderer.domElement);
    controls.enableDamping = true;
    controls.zoomToCursor = true;
    controls.screenSpacePanning = true;
    const res = new THREE.Group();
    scene.add(res);
    S.current = {
      scene, cam, controls, model: null, hi: null, ov: null, res,
      matModel: new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.55, side: THREE.DoubleSide }),
      matHi: new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide }),
      matOv: new THREE.MeshBasicMaterial({ color: 0x14b8a6, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
      matIns: new THREE.MeshStandardMaterial({ color: 0x14b8a6, roughness: 0.5, side: THREE.DoubleSide }),
      matResModell: new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.55, side: THREE.DoubleSide }),
    };

    const fit = () => {
      const s = S.current!;
      if (!s.model) return;
      const b = new THREE.Box3().setFromObject(s.model);
      const c = b.getCenter(new THREE.Vector3()), size = b.getSize(new THREE.Vector3());
      const r = Math.max(size.x, size.y, size.z);
      const dist = (r / 2 / Math.tan((cam.fov * Math.PI) / 360)) * 1.6;
      cam.up.set(0, 0, 1);
      cam.position.set(c.x, c.y - dist * 0.7, c.z + dist * 0.7);
      controls.target.copy(c);
      controls.minDistance = Math.max(2, r * 0.05);
      controls.maxDistance = r * 10;
      cam.near = Math.max(0.2, r * 0.005);
      cam.far = r * 40;
      cam.updateProjectionMatrix();
      controls.update();
    };
    props.api.current = {
      fit,
      lookAtFace: () => {
        const f = P.current.face;
        if (!f) return;
        const o = new THREE.Vector3().setFromMatrixPosition(f.frame);
        const yAx = new THREE.Vector3().setFromMatrixColumn(f.frame, 1);
        const r = Math.max(f.size.w, f.size.h, 20);
        const dist = (r / 2 / Math.tan((cam.fov * Math.PI) / 360)) * 1.5;
        cam.up.copy(yAx);
        cam.position.copy(o).addScaledVector(f.normal, dist);
        controls.target.copy(o);
        cam.updateProjectionMatrix();
        controls.update();
      },
    };

    // Klick = Fläche wählen, Ziehen auf dem Text = verschieben
    const ray = new THREE.Raycaster();
    const ndc = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };
    let down: { x: number; y: number } | null = null;
    let drag: { sx: number; sy: number; dx0: number; dy0: number; inv: THREE.Matrix4 } | null = null;
    const planeHit = (e: PointerEvent, f: FaceInfo) => {
      ray.setFromCamera(ndc(e), cam);
      const o = new THREE.Vector3().setFromMatrixPosition(f.frame);
      const hit = ray.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(f.normal, o), new THREE.Vector3());
      return hit;
    };
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
      const p = P.current, s = S.current!;
      if (p.pick || !p.face || !s.ov || !s.ov.visible) return;
      const hit = planeHit(e, p.face);
      if (!hit) return;
      const box = new THREE.Box3().setFromObject(s.ov).expandByScalar(1);
      if (!box.containsPoint(hit)) return;
      const inv = p.face.frame.clone().invert();
      const l = hit.clone().applyMatrix4(inv);
      drag = { sx: l.x, sy: l.y, dx0: p.place.dx, dy0: p.place.dy, inv };
      controls.enabled = false;
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      const p = P.current;
      if (!drag || !p.face) return;
      const hit = planeHit(e, p.face);
      if (!hit) return;
      const l = hit.applyMatrix4(drag.inv);
      p.onMove(drag.dx0 + (l.x - drag.sx), drag.dy0 + (l.y - drag.sy));
    };
    const onUp = (e: PointerEvent) => {
      const p = P.current, s = S.current!;
      if (drag) { drag = null; controls.enabled = true; return; }
      if (!down || !p.pick || !s.model || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      ray.setFromCamera(ndc(e), cam);
      const hit = ray.intersectObject(s.model, false)[0];
      if (hit && hit.faceIndex != null) p.onPick(hit.faceIndex);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointermove", onMove);
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
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerup", onUp);
      controls.dispose();
      scene.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
      renderer.dispose();
      el.removeChild(renderer.domElement);
      S.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const s = S.current;
    if (!s) return;
    if (s.model) { s.scene.remove(s.model); s.model = null; }
    if (props.model) {
      s.model = new THREE.Mesh(props.model, s.matModel);
      s.scene.add(s.model);
      props.api.current?.fit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.model]);

  useEffect(() => {
    const s = S.current;
    if (!s) return;
    if (s.hi) { s.scene.remove(s.hi); s.hi.geometry.dispose(); s.hi = null; }
    if (props.face && props.model) {
      const pos = props.model.getAttribute("position");
      const arr = new Float32Array(props.face.tris.length * 9);
      props.face.tris.forEach((t, i) => { for (let k = 0; k < 9; k++) arr[i * 9 + k] = (pos.array as Float32Array)[t * 9 + k]; });
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
      s.hi = new THREE.Mesh(g, s.matHi);
      s.scene.add(s.hi);
    }
  }, [props.face, props.model]);

  useEffect(() => {
    const s = S.current;
    if (!s) return;
    if (s.ov) { s.scene.remove(s.ov); s.ov = null; }
    if (props.overlay) { s.ov = new THREE.Mesh(props.overlay, s.matOv); s.scene.add(s.ov); }
  }, [props.overlay]);

  useEffect(() => {
    const s = S.current;
    if (!s) return;
    s.res.clear();
    const show = !!props.result && props.showResult;
    if (show && props.result) {
      const m1 = new THREE.Mesh(props.result.modell, s.matResModell);
      const m2 = new THREE.Mesh(props.result.einlage, s.matIns);
      m1.visible = props.showModell;
      m2.visible = props.showEinlage;
      s.res.add(m1, m2);
    }
    if (s.model) s.model.visible = !show;
    if (s.hi) s.hi.visible = !show;
    if (s.ov) s.ov.visible = !show;
  }, [props.result, props.showResult, props.model, props.face, props.overlay, props.showModell, props.showEinlage]);

  useEffect(() => {
    const s = S.current;
    if (!s) return;
    s.matResModell.color.set(props.colModell);
    s.matIns.color.set(props.colEinlage);
  }, [props.colModell, props.colEinlage]);

  return <div ref={host} className={cn("h-[420px] w-full rounded-xl border bg-gradient-to-b from-muted/40 to-muted/10 sm:h-[600px]", props.pick && "cursor-crosshair")} />;
}

function download(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ---------- Seite ---------- */

export default function GravurPage() {
  const [model, setModel] = useState<THREE.BufferGeometry | null>(null);
  const [modelName, setModelName] = useState("");
  const [face, setFace] = useState<FaceInfo | null>(null);
  const [pick, setPick] = useState(false);
  const [raster, setRaster] = useState<RasterIn | null>(null);
  const [imgName, setImgName] = useState("");
  const [invert, setInvert] = useState<"auto" | "ja" | "nein">("auto");
  const [auto, setAuto] = useState(true);
  const [th, setTh] = useState(128);
  const [prep, setPrep] = useState<Prepared | null>(null);
  const [place, setPlace] = useState<Place>(DEFAULT_PLACE);
  const [touched, setTouched] = useState(false);
  const [result, setResult] = useState<EngraveResult | null>(null);
  const [showResult, setShowResult] = useState(true);
  const [colModell, setColModell] = useState("#9aa3ad");
  const [colEinlage, setColEinlage] = useState("#14b8a6");
  const [showModell, setShowModell] = useState(true);
  const [showEinlage, setShowEinlage] = useState(true);
  const { farbenFor } = useMaterialFarben();
  const farben = farbenFor("PLA");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [batch, setBatch] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<{ i: number; n: number; fehler: string[] } | null>(null);
  const api = useRef<{ lookAtFace: () => void; fit: () => void } | null>(null);

  const setP = useCallback((q: Partial<Place>) => { setTouched(true); setPlace((p) => ({ ...p, ...q })); }, []);

  // Bild -> Vektor (bei Schwellwert/Invertierung neu)
  useEffect(() => {
    if (!raster) { setPrep(null); return; }
    const t = setTimeout(() => {
      try {
        const p = prepareImage(raster, { threshold: auto ? null : th, invert: invert === "auto" ? null : invert === "ja" });
        setPrep(p);
        setErr(p.shapes.length ? "" : "Im Bild wurde kein Text gefunden. Invertierung oder Schwellwert ändern.");
      } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    }, 60);
    return () => clearTimeout(t);
  }, [raster, invert, auto, th]);

  // sinnvolle Startbreite: 80 % der Fläche, solange nichts verändert wurde
  useEffect(() => {
    if (face && prep && !touched) setPlace((p) => ({ ...p, widthMm: Math.max(5, Math.round(Math.min(face.size.w, face.size.h / Math.max(0.2, prep.height / prep.width)) * 0.8)) }));
  }, [face, prep, touched]);

  useEffect(() => { setResult(null); }, [place, prep, face, model]);

  const overlay = useMemo(() => (prep && face ? overlayGeometry(prep, place, face.frame) : null), [prep, face, place]);

  const loadModel = async (f: File | undefined) => {
    if (!f) return;
    setErr("");
    try {
      const g = geometryFromFile(f.name, await f.arrayBuffer());
      setModel(g);
      setModelName(f.name);
      setFace(null);
      setPick(true);
      setResult(null);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  };
  const loadImage = async (f: File | undefined) => {
    if (!f) return;
    setErr("");
    try { setRaster(await rasterFromFile(f)); setImgName(f.name); } catch { setErr("Bild konnte nicht gelesen werden (PNG, JPG, WebP oder SVG)."); }
  };
  const onPick = useCallback((tri: number) => {
    if (!model) return;
    const f = faceRegion(model, tri);
    if (!f) return;
    setFace(f);
    setPick(false);
    setTimeout(() => api.current?.lookAtFace(), 0);
  }, [model]);

  const rechnen = async () => {
    if (!model || !face || !prep) return;
    setBusy(true);
    setProgress(null);
    setErr("");
    await new Promise((r) => setTimeout(r, 30));
    try {
      const r = engrave(model, prep, place, face.frame);
      if (!r || r.volEinlage < 1e-6) setErr("Der Text liegt nicht auf dem Modell. Position oder Fläche prüfen.");
      else { setResult(r); setShowResult(true); }
    } catch (e) { setErr(`Berechnung fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`); }
    setBusy(false);
  };

  const base = safeName(imgName || "gravur");
  const dlStl = (g: THREE.BufferGeometry, suffix: string) => download(new Blob([toStl(g)], { type: "model/stl" }), `${safeName(modelName)}-${base}-${suffix}.stl`);
  const dl3mf = async () => result && download(await to3mf([{ name: "Modell mit Gravur", geo: result.modell, color: colModell }, { name: "Text-Einlage", geo: result.einlage, color: colEinlage }], `${safeName(modelName)} ${base}`), `${safeName(modelName)}-${base}.3mf`);

  const stapel = async () => {
    if (!model || !face || !files.length) return;
    setBusy(true);
    setErr("");
    const zip = new JSZip();
    const fehler: string[] = [];
    for (let i = 0; i < files.length; i++) {
      setProgress({ i, n: files.length, fehler });
      await new Promise((r) => setTimeout(r, 20));
      const f = files[i];
      try {
        const p = prepareImage(await rasterFromFile(f), { threshold: auto ? null : th, invert: invert === "auto" ? null : invert === "ja" });
        if (!p.shapes.length) { fehler.push(`${f.name}: kein Text gefunden`); continue; }
        const r = engrave(model, p, place, face.frame);
        if (!r || r.volEinlage < 1e-6) { fehler.push(`${f.name}: Text liegt nicht auf dem Modell`); continue; }
        const nm = `${String(i + 1).padStart(3, "0")}-${safeName(f.name)}`;
        const dir = zip.folder(nm)!;
        dir.file(`${nm}-modell.stl`, toStl(r.modell));
        dir.file(`${nm}-einlage.stl`, toStl(r.einlage));
        dir.file(`${nm}.3mf`, await to3mf([{ name: "Modell mit Gravur", geo: r.modell, color: colModell }, { name: "Text-Einlage", geo: r.einlage, color: colEinlage }], nm));
        r.modell.dispose();
        r.einlage.dispose();
      } catch (e) { fehler.push(`${f.name}: ${e instanceof Error ? e.message : String(e)}`); }
    }
    if (fehler.length) zip.file("FEHLER.txt", fehler.join("\n"));
    setProgress({ i: files.length, n: files.length, fehler });
    download(await zip.generateAsync({ type: "blob" }), `gravur-stapel-${safeName(modelName)}.zip`);
    setBusy(false);
  };

  const bereit = !!(model && face && prep?.shapes.length);

  return (
    <div className="mx-auto max-w-[1300px] space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-bold">Gravur-Werkzeug <span className="ml-2 rounded bg-primary/10 px-2 py-0.5 align-middle text-xs font-semibold text-primary">NEU</span></h1>
        <p className="text-sm text-muted-foreground">Bild mit Text wird 1:1 in ein 3D-Modell geschnitten, ohne Offset. Ergebnis: Modell mit Aussparung und die passende Text-Einlage, an Ort und Stelle. Nur im Admin sichtbar.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
        <div className="space-y-3">
          <div className="relative">
            <Viewer model={model} face={face} overlay={overlay} result={result} showResult={showResult} colModell={colModell} colEinlage={colEinlage} showModell={showModell} showEinlage={showEinlage} pick={pick} place={place} onPick={onPick} onMove={(dx, dy) => setP({ dx, dy })} api={api} />
            {!model && <div className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-muted-foreground">Zuerst ein 3D-Modell (STL oder OBJ) laden.</div>}
            {pick && model && <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"><Crosshair className="h-3.5 w-3.5" />Klicke auf die Fläche, in die graviert werden soll</div>}
            {!pick && face && prep && !result && <div className="absolute left-3 top-3 rounded-full bg-background/85 px-2.5 py-1 text-xs text-muted-foreground">Text mit der Maus verschieben</div>}
            <div className="absolute bottom-3 right-3 flex gap-1.5">
              {face && <button type="button" onClick={() => api.current?.lookAtFace()} className="rounded-full border bg-background/85 px-2.5 py-1 text-xs hover:bg-background">Senkrecht auf Fläche</button>}
              <button type="button" onClick={() => api.current?.fit()} className="rounded-full border bg-background/85 px-2.5 py-1 text-xs hover:bg-background">Ansicht zurücksetzen</button>
            </div>
          </div>
          {result && (
            <div className="space-y-2 rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2 text-sm font-medium"><CheckCircle2 className="h-4 w-4 text-green-600" />Fertig berechnet: Einlage {(result.volEinlage / 1000).toFixed(3)} cm³, Aussparung ohne Spiel</div>
              {result.rueckfall && <div className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />Das Modell ist nicht ganz geschlossen: Die Einlage wurde als voller Textkörper von der Fläche bis zur Gravurtiefe gebaut. Bei gebogenen Flächen kann ihre Oberseite leicht vom Modell abweichen.</div>}
              <div className="grid gap-2 sm:grid-cols-2">
                {([["Modell", colModell, setColModell, showModell, setShowModell], ["Text-Einlage", colEinlage, setColEinlage, showEinlage, setShowEinlage]] as const).map(([lbl, col, setCol, vis, setVis]) => (
                  <div key={lbl} className="space-y-1.5 rounded-lg border p-2.5">
                    <label className="flex items-center gap-1.5 text-xs font-medium"><input type="checkbox" checked={vis} onChange={(e) => setVis(e.target.checked)} />{lbl} anzeigen</label>
                    <div className="flex flex-wrap items-center gap-1">
                      {farben.slice(0, 18).map((c) => (
                        <button key={c.name} type="button" title={c.name} aria-label={c.name} onClick={() => setCol(c.hex)}
                          className={cn("h-5 w-5 rounded-full border border-black/10", col.toLowerCase() === c.hex.toLowerCase() && "ring-2 ring-primary ring-offset-1 ring-offset-background")} style={{ backgroundColor: c.hex }} />
                      ))}
                      <input type="color" value={col} onChange={(e) => setCol(e.target.value)} className="h-5 w-7 cursor-pointer rounded border bg-transparent p-0" aria-label="Eigene Farbe" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={dl3mf}><Download className="mr-1.5 h-4 w-4" />3MF (Baugruppe)</Button>
                <Button variant="outline" onClick={() => dlStl(result.modell, "modell")}><Download className="mr-1.5 h-4 w-4" />Modell STL</Button>
                <Button variant="outline" onClick={() => dlStl(result.einlage, "einlage")}><Download className="mr-1.5 h-4 w-4" />Einlage STL</Button>
                <Button variant="ghost" onClick={() => setShowResult((v) => !v)}><Eye className="mr-1.5 h-4 w-4" />{showResult ? "Vorlage zeigen" : "Ergebnis zeigen"}</Button>
              </div>
              <p className="text-[11px] text-muted-foreground">Beide Teile liegen im Koordinatensystem des Originals. Im Slicer zusammen laden, dann sitzt alles an der richtigen Stelle. Die Einlage hat keinen Offset: für die Passung ggf. im Slicer mit Toleranz drucken.</p>
            </div>
          )}
          {err && <div className="flex items-start gap-1.5 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{err}</div>}
        </div>

        <div className="space-y-6 rounded-xl border bg-card p-5">
          <Step n={1} title="MODELL">
            <input type="file" accept=".stl,.obj" onChange={(e) => loadModel(e.target.files?.[0])} className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1.5 file:text-sm" />
            {model && <p className="text-xs text-muted-foreground">{modelName} · {(model.getAttribute("position").count / 3).toLocaleString("de-CH")} Dreiecke (Einheit mm)</p>}
          </Step>

          <Step n={2} title="AUSRICHTFLÄCHE">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant={pick ? "default" : "outline"} disabled={!model} onClick={() => setPick((v) => !v)}><Crosshair className="mr-1.5 h-4 w-4" />{face ? "Andere Fläche wählen" : "Fläche wählen"}</Button>
              {face && <span className="text-xs text-muted-foreground">{face.size.w.toFixed(1)} × {face.size.h.toFixed(1)} mm, {face.tris.length} Dreiecke</span>}
            </div>
            <p className="text-[11px] text-muted-foreground">Die gewählte Fläche ist die Nullebene: Oberfläche des Modells = 0, die Gravur geht senkrecht dazu nach innen.</p>
          </Step>

          <Step n={3} title="BILD MIT TEXT">
            <input type="file" accept="image/*" onChange={(e) => loadImage(e.target.files?.[0])} className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1.5 file:text-sm" />
            {prep && <p className="text-xs text-muted-foreground">{imgName} · {prep.width}×{prep.height} px · {prep.loops} Konturen erkannt</p>}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <label className="flex items-center gap-1.5">Text ist <select value={invert} onChange={(e) => setInvert(e.target.value as typeof invert)} className="rounded border bg-background px-1.5 py-0.5"><option value="auto">automatisch</option><option value="nein">kleinere Fläche</option><option value="ja">umgekehrt</option></select></label>
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />Schwellwert automatisch</label>
            </div>
            {!auto && <Num label="Schwellwert" unit="" value={th} min={5} max={250} step={1} onChange={setTh} />}
          </Step>

          <Step n={4} title="POSITION UND GRÖSSE">
            <Num label="Breite des Bildes" unit="mm" value={place.widthMm} min={2} max={Math.max(100, Math.round((face?.size.w ?? 100) * 1.5))} step={0.5} onChange={(v) => setP({ widthMm: Math.max(1, v) })} />
            <Num label="Verschieben X" unit="mm" value={place.dx} min={-Math.max(50, face?.size.w ?? 50)} max={Math.max(50, face?.size.w ?? 50)} step={0.1} onChange={(v) => setP({ dx: v })} />
            <Num label="Verschieben Y" unit="mm" value={place.dy} min={-Math.max(50, face?.size.h ?? 50)} max={Math.max(50, face?.size.h ?? 50)} step={0.1} onChange={(v) => setP({ dy: v })} />
            <Num label="Drehen" unit="°" value={place.rotDeg} min={-180} max={180} step={0.5} onChange={(v) => setP({ rotDeg: v })} />
            <Num label="Gravurtiefe" unit="mm" value={place.depth} min={0.1} max={10} step={0.05} onChange={(v) => setP({ depth: Math.max(0.05, v) })} />
            <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={place.centerInk} onChange={(e) => setP({ centerInk: e.target.checked })} />Mitte des Textes statt Bildmitte als Ankerpunkt</label>
            <Button variant="ghost" size="sm" onClick={() => { setTouched(false); setPlace({ ...DEFAULT_PLACE }); }}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Zurücksetzen</Button>
          </Step>

          <Step n={5} title="BERECHNEN">
            <Button className="w-full" disabled={!bereit || busy} onClick={rechnen}>
              {busy && !progress ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Scissors className="mr-1.5 h-4 w-4" />}Text ausschneiden
            </Button>
            {!bereit && <p className="text-[11px] text-muted-foreground">Es fehlen noch: {[!model && "Modell", model && !face && "Fläche", !prep?.shapes.length && "Bild"].filter(Boolean).join(", ")}.</p>}
          </Step>

          <Step n={6} title="MASSENMODUS">
            <label className="flex items-center gap-1.5 text-sm font-medium"><input type="checkbox" checked={batch} onChange={(e) => setBatch(e.target.checked)} /><Package className="h-4 w-4" />Viele Bilder auf dasselbe Modell anwenden</label>
            {batch && (
              <div className="space-y-2">
                <p className="text-[11px] text-muted-foreground">Fläche, Breite, Position, Drehung und Tiefe aus den Einstellungen oben gelten für alle Bilder. Jedes Bild wird auf dieselbe Rahmenbreite gebracht und an derselben Stelle ausgerichtet. Für Bilder mit unterschiedlich langem Text oben «Mitte des Textes» aktivieren.</p>
                <input type="file" accept="image/*" multiple onChange={(e) => setFiles([...(e.target.files ?? [])])} className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1.5 file:text-sm" />
                {files.length > 0 && <p className="text-xs text-muted-foreground">{files.length} Bilder gewählt</p>}
                <Button className="w-full" variant="outline" disabled={!model || !face || !files.length || busy} onClick={stapel}>
                  {busy && progress ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Package className="mr-1.5 h-4 w-4" />}Alle berechnen (ZIP)
                </Button>
                {progress && (
                  <div className="space-y-1 text-xs">
                    <div className="h-1.5 overflow-hidden rounded bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${(progress.i / progress.n) * 100}%` }} /></div>
                    <div className="tabular-nums text-muted-foreground">{progress.i} von {progress.n}{progress.fehler.length ? ` · ${progress.fehler.length} Fehler (siehe FEHLER.txt im ZIP)` : ""}</div>
                  </div>
                )}
              </div>
            )}
          </Step>
        </div>
      </div>
    </div>
  );
}
