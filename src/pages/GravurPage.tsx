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
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_PLACE, faceRegion, overlayGeometry, prepareImage, safeName, to3mf, toStl, volume, type EngraveResult, type FaceInfo, type Place, type Prepared, type RasterIn } from "@/lib/gravur";

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

type Api = { lookAtFace: () => void; fit: () => void; fitBox: (b: THREE.Box3, below: boolean) => void };
type ViewProps = {
  model: THREE.BufferGeometry | null;
  /** Ebene 0 = Text, Ebene 1 = Logo */
  faces: (FaceInfo | null)[];
  overlays: (THREE.BufferGeometry | null)[];
  places: Place[];
  active: number;
  onActivate: (i: number) => void;
  result: EngraveResult | null;
  showResult: boolean;
  colModell: string;
  colEinlage: string;
  colLogo: string;
  showModell: boolean;
  showEinlage: boolean;
  showLogo: boolean;
  bed: boolean;
  pick: boolean;
  onPick: (tri: number) => void;
  onMove: (layer: number, dx: number, dy: number) => void;
  api: React.MutableRefObject<Api | null>;
};

const LAYER_COL = [0x14b8a6, 0xa855f7];
const HI_COL = [0x3b82f6, 0xa855f7];

function Viewer(props: ViewProps) {
  const host = useRef<HTMLDivElement>(null);
  const P = useRef(props);
  P.current = props;
  const S = useRef<{
    scene: THREE.Scene; cam: THREE.PerspectiveCamera; controls: OrbitControls;
    model: THREE.Mesh | null; hi: (THREE.Mesh | null)[]; ov: (THREE.Mesh | null)[]; res: THREE.Group;
    matModel: THREE.MeshStandardMaterial; matHi: THREE.MeshBasicMaterial[]; matOv: THREE.MeshBasicMaterial[];
    matIns: THREE.MeshStandardMaterial; matLogo: THREE.MeshStandardMaterial; matResModell: THREE.MeshStandardMaterial;
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
    const side = THREE.DoubleSide;
    S.current = {
      scene, cam, controls, model: null, hi: [null, null], ov: [null, null], res,
      matModel: new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.55, side }),
      matHi: HI_COL.map((c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side })),
      matOv: LAYER_COL.map((c) => new THREE.MeshBasicMaterial({ color: c, side, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })),
      matIns: new THREE.MeshStandardMaterial({ color: 0x14b8a6, roughness: 0.5, side }),
      matLogo: new THREE.MeshStandardMaterial({ color: 0xa855f7, roughness: 0.5, side }),
      matResModell: new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.55, side }),
    };

    const fitBox = (b: THREE.Box3, below = false) => {
      const c = b.getCenter(new THREE.Vector3()), size = b.getSize(new THREE.Vector3());
      const r = Math.max(size.x, size.y, size.z);
      const dist = (r / 2 / Math.tan((cam.fov * Math.PI) / 360)) * 1.6;
      cam.up.set(0, 0, 1);
      cam.position.set(c.x, c.y - dist * 0.7, c.z + (below ? -1 : 1) * dist * 0.7);
      controls.target.copy(c);
      controls.minDistance = Math.max(2, r * 0.05);
      controls.maxDistance = r * 10;
      cam.near = Math.max(0.2, r * 0.005);
      cam.far = r * 40;
      cam.updateProjectionMatrix();
      controls.update();
    };
    const fit = () => {
      const s = S.current!;
      if (s.model) fitBox(new THREE.Box3().setFromObject(s.model));
    };
    props.api.current = {
      fit,
      fitBox,
      lookAtFace: () => {
        const f = P.current.faces[P.current.active];
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

    // Klick = Fläche wählen, Ziehen auf Text oder Logo = verschieben
    const ray = new THREE.Raycaster();
    const ndc = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };
    let down: { x: number; y: number } | null = null;
    let drag: { li: number; sx: number; sy: number; dx0: number; dy0: number; inv: THREE.Matrix4 } | null = null;
    const planeHit = (e: PointerEvent, f: FaceInfo) => {
      ray.setFromCamera(ndc(e), cam);
      const o = new THREE.Vector3().setFromMatrixPosition(f.frame);
      return ray.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(f.normal, o), new THREE.Vector3());
    };
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
      const p = P.current, s = S.current!;
      if (p.pick) return;
      for (const li of [p.active, 1 - p.active]) {
        const f = p.faces[li], ov = s.ov[li];
        if (!f || !ov || !ov.visible) continue;
        const hit = planeHit(e, f);
        if (!hit) continue;
        const box = new THREE.Box3().setFromObject(ov).expandByScalar(1);
        if (!box.containsPoint(hit)) continue;
        if (li !== p.active) p.onActivate(li);
        const inv = f.frame.clone().invert();
        const l = hit.clone().applyMatrix4(inv);
        drag = { li, sx: l.x, sy: l.y, dx0: p.places[li].dx, dy0: p.places[li].dy, inv };
        controls.enabled = false;
        renderer.domElement.setPointerCapture(e.pointerId);
        return;
      }
    };
    const onMove = (e: PointerEvent) => {
      const p = P.current;
      if (!drag) return;
      const f = p.faces[drag.li];
      if (!f) return;
      const hit = planeHit(e, f);
      if (!hit) return;
      const l = hit.applyMatrix4(drag.inv);
      p.onMove(drag.li, drag.dx0 + (l.x - drag.sx), drag.dy0 + (l.y - drag.sy));
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

  // markierte Flächen (Text blau, Logo violett)
  useEffect(() => {
    const s = S.current;
    if (!s) return;
    for (let li = 0; li < 2; li++) {
      const old = s.hi[li];
      if (old) { s.scene.remove(old); old.geometry.dispose(); s.hi[li] = null; }
      const f = props.faces[li];
      if (f && props.model) {
        const pos = props.model.getAttribute("position");
        const arr = new Float32Array(f.tris.length * 9);
        f.tris.forEach((t, i) => { for (let k = 0; k < 9; k++) arr[i * 9 + k] = (pos.array as Float32Array)[t * 9 + k]; });
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
        s.hi[li] = new THREE.Mesh(g, s.matHi[li]);
        s.scene.add(s.hi[li]!);
      }
    }
  }, [props.faces, props.model]);

  useEffect(() => {
    const s = S.current;
    if (!s) return;
    for (let li = 0; li < 2; li++) {
      if (s.ov[li]) { s.scene.remove(s.ov[li]!); s.ov[li] = null; }
      const g = props.overlays[li];
      if (g) { s.ov[li] = new THREE.Mesh(g, s.matOv[li]); s.scene.add(s.ov[li]!); }
    }
  }, [props.overlays]);

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
      if (props.result.logo) {
        const m3 = new THREE.Mesh(props.result.logo, s.matLogo);
        m3.visible = props.showLogo;
        s.res.add(m3);
      }
    }
    if (show && props.bed && s.res.children.length) props.api.current?.fitBox(new THREE.Box3().setFromObject(s.res), true);
    if (s.model) s.model.visible = !show;
    for (const m of [...s.hi, ...s.ov]) if (m) m.visible = !show;
  }, [props.result, props.showResult, props.model, props.faces, props.overlays, props.showModell, props.showEinlage, props.showLogo, props.bed]);

  useEffect(() => {
    const s = S.current;
    if (!s) return;
    s.matResModell.color.set(props.colModell);
    s.matIns.color.set(props.colEinlage);
    s.matLogo.color.set(props.colLogo);
  }, [props.colModell, props.colEinlage, props.colLogo]);

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

const LOGO_PLACE: Place = { ...DEFAULT_PLACE, widthMm: 20 };
type SavedLogo = { name: string; path: string; url: string };

function LayerSwitch({ active, onChange }: { active: number; onChange: (i: number) => void }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">Bearbeiten:</span>
      <div className="inline-flex rounded-full border bg-muted/40 p-0.5">
        {["Text", "Logo"].map((l, i) => (
          <button key={l} type="button" onClick={() => onChange(i)} className={cn("rounded-full px-3 py-1 font-medium transition-colors", active === i ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{l}</button>
        ))}
      </div>
    </div>
  );
}

export default function GravurPage() {
  const [model, setModel] = useState<THREE.BufferGeometry | null>(null);
  const [modelName, setModelName] = useState("");
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [faces, setFaces] = useState<(FaceInfo | null)[]>([null, null]);
  const [active, setActive] = useState(0);
  const [pick, setPick] = useState(false);
  const [raster, setRaster] = useState<RasterIn | null>(null);
  const [imgName, setImgName] = useState("");
  const [imgFile, setImgFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [invert, setInvert] = useState<"auto" | "ja" | "nein">("auto");
  const [auto, setAuto] = useState(true);
  const [th, setTh] = useState(128);
  const [prep, setPrep] = useState<Prepared | null>(null);
  const [place, setPlace] = useState<Place>(DEFAULT_PLACE);
  const [touched, setTouched] = useState(false);
  // Logo (zweite Ebene, bleibt im Storage gespeichert)
  const [useLogo, setUseLogo] = useState(false);
  const [logos, setLogos] = useState<SavedLogo[]>([]);
  const [logoSel, setLogoSel] = useState<{ path: string; name: string } | null>(null);
  const [rasterL, setRasterL] = useState<RasterIn | null>(null);
  const [prepL, setPrepL] = useState<Prepared | null>(null);
  const [placeL, setPlaceL] = useState<Place>(LOGO_PLACE);
  const [touchedL, setTouchedL] = useState(false);
  const [logoInvert, setLogoInvert] = useState<"auto" | "ja" | "nein">("auto");
  const [result, setResult] = useState<EngraveResult | null>(null);
  const [showResult, setShowResult] = useState(true);
  const [colModell, setColModell] = useState("#9aa3ad");
  const [colEinlage, setColEinlage] = useState("#14b8a6");
  const [colLogo, setColLogo] = useState("#a855f7");
  const [showModell, setShowModell] = useState(true);
  const [showEinlage, setShowEinlage] = useState(true);
  const [showLogo, setShowLogo] = useState(true);
  const [bed, setBed] = useState(true);
  const { farbenFor } = useMaterialFarben();
  const farben = farbenFor("PLA");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [batch, setBatch] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<{ i: number; n: number; fehler: string[] } | null>(null);
  const api = useRef<Api | null>(null);

  const layer = useLogo && logoSel ? active : 0; // ohne Logo gibt es nur die Text-Ebene
  const face = faces[0];
  const faceL = faces[1];
  const curFace = faces[layer];
  const curPlace = layer ? placeL : place;
  const setPlaceFor = useCallback((li: number, q: Partial<Place>) => {
    if (li) { setTouchedL(true); setPlaceL((p) => ({ ...p, ...q })); } else { setTouched(true); setPlace((p) => ({ ...p, ...q })); }
  }, []);
  const setP = (q: Partial<Place>) => setPlaceFor(layer, q);

  const call = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("gravur-server", { body });
    if (error || data?.error) {
      let msg: string | undefined = data?.error;
      if (!msg && error && "context" in error && error.context instanceof Response) {
        msg = await error.context.clone().json().then((j: { error?: string }) => j?.error).catch(() => undefined);
      }
      throw new Error(msg || error?.message || "Server nicht erreichbar");
    }
    return data;
  };

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

  useEffect(() => {
    if (!rasterL) { setPrepL(null); return; }
    const t = setTimeout(() => {
      try { setPrepL(prepareImage(rasterL, { invert: logoInvert === "auto" ? null : logoInvert === "ja" })); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    }, 60);
    return () => clearTimeout(t);
  }, [rasterL, logoInvert]);

  // sinnvolle Startbreiten, solange nichts verändert wurde
  useEffect(() => {
    if (face && prep && !touched) setPlace((p) => ({ ...p, widthMm: Math.max(5, Math.round(Math.min(face.size.w, face.size.h / Math.max(0.2, prep.height / prep.width)) * 0.8)) }));
  }, [face, prep, touched]);
  useEffect(() => {
    if (faceL && prepL && !touchedL) setPlaceL((p) => ({ ...p, widthMm: Math.max(3, Math.round(Math.min(faceL.size.w, faceL.size.h / Math.max(0.2, prepL.height / prepL.width)) * 0.3)) }));
  }, [faceL, prepL, touchedL]);

  useEffect(() => { setResult(null); }, [place, prep, faces, model, bed, useLogo, placeL, prepL]);

  const loadLogos = useCallback(async () => {
    try { setLogos((await call({ action: "logo_list" })).logos ?? []); } catch { /* Liste bleibt leer */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { void loadLogos(); }, [loadLogos]);

  const overlays = useMemo(
    () => [
      prep && face ? overlayGeometry(prep, place, face.frame) : null,
      useLogo && prepL && faceL ? overlayGeometry(prepL, placeL, faceL.frame) : null,
    ],
    [prep, face, place, useLogo, prepL, faceL, placeL],
  );
  const viewFaces = useMemo(() => [faces[0], useLogo && logoSel ? faces[1] : null], [faces, useLogo, logoSel]);

  const loadModel = async (f: File | undefined) => {
    if (!f) return;
    setErr("");
    try {
      const g = geometryFromFile(f.name, await f.arrayBuffer());
      setModel(g);
      setModelFile(f);
      setModelName(f.name);
      setFaces([null, null]);
      setActive(0);
      setPick(true);
      setResult(null);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  };
  const loadImage = async (f: File | undefined) => {
    if (!f) return;
    setErr("");
    try { setRaster(await rasterFromFile(f)); setImgName(f.name); setImgFile(f); } catch { setErr("Bild konnte nicht gelesen werden (PNG, JPG, WebP oder SVG)."); }
  };
  const onPick = useCallback((tri: number) => {
    if (!model) return;
    const f = faceRegion(model, tri);
    if (!f) return;
    setFaces((fs) => fs.map((x, i) => (i === layer ? f : x)));
    setPick(false);
    setTimeout(() => api.current?.lookAtFace(), 0);
  }, [model, layer]);

  // Logos: einmal hochladen, dann liegen sie im Storage und stehen bei jedem Auftrag bereit
  const selectLogo = async (l: SavedLogo) => {
    setErr("");
    try {
      const r = await fetch(l.url);
      if (!r.ok) throw new Error(String(r.status));
      const blob = await r.blob();
      setRasterL(await rasterFromFile(new File([blob], l.path.split("/").pop() ?? "logo.png", { type: blob.type })));
      setLogoSel({ path: l.path, name: l.name });
      setTouchedL(false);
      setUseLogo(true);
    } catch { setErr("Logo konnte nicht geladen werden."); }
  };
  const uploadLogo = async (f: File | undefined) => {
    if (!f) return;
    setErr("");
    try {
      const raster = await rasterFromFile(f);
      const init = await call({ action: "logo_init", name: f.name });
      const { error } = await supabase.storage.from("project-uploads").uploadToSignedUrl(init.path, init.token, f);
      if (error) throw new Error(error.message);
      setRasterL(raster);
      setLogoSel({ path: init.path, name: init.name });
      setTouchedL(false);
      setUseLogo(true);
      await loadLogos();
    } catch (e) { setErr(`Logo-Upload fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`); }
  };
  const deleteLogo = async (l: SavedLogo) => {
    try {
      await call({ action: "logo_delete", path: l.path });
      if (logoSel?.path === l.path) { setLogoSel(null); setRasterL(null); setUseLogo(false); }
      await loadLogos();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  };

  // Alles Rechnen läuft auf dem Server (muscio): Dateien gehen in den Storage, der Server holt sie dort ab,
  // rechnet (Potrace + Manifold) und legt ein ZIP zurück. Hier läuft nur die Vorschau.
  // Punkt auf der angeklickten Fläche (Mitte des ersten Dreiecks), damit der Server dieselbe ebene Fläche findet
  const seedOf = (f: FaceInfo | null): number[] | null => {
    if (!model || !f?.tris.length) return null;
    const pos = model.getAttribute("position");
    const t = f.tris[0];
    const c = (get: (i: number) => number) => (get(t * 3) + get(t * 3 + 1) + get(t * 3 + 2)) / 3;
    return [c((i) => pos.getX(i)), c((i) => pos.getY(i)), c((i) => pos.getZ(i))];
  };
  const logoAktiv = !!(useLogo && logoSel && faceL && prepL?.shapes.length);
  const serverJob = async (bilder: File[]): Promise<Blob> => {
    if (!modelFile || !face) throw new Error("Modell und Fläche fehlen");
    const bucket = supabase.storage.from("project-uploads");
    setStatus("Dateien hochladen …");
    const init = await call({ action: "init", model_name: modelFile.name, images: bilder.map((f) => f.name) });
    {
      const { error } = await bucket.uploadToSignedUrl(init.model.path, init.model.token, modelFile);
      if (error) throw new Error(`Modell-Upload: ${error.message}`);
    }
    for (let i = 0; i < bilder.length; i++) {
      setStatus(`Bilder hochladen … ${i + 1} von ${bilder.length}`);
      const { error } = await bucket.uploadToSignedUrl(init.images[i].path, init.images[i].token, bilder[i]);
      if (error) throw new Error(`Bild-Upload: ${error.message}`);
    }
    const start = await call({
      action: "start", job: init.job, model_path: init.model.path, images: init.images.map((x: { path: string; name: string }) => ({ path: x.path, name: x.name })),
      frame: face.frame.elements, place, threshold: auto ? null : th, invert: invert === "auto" ? null : invert === "ja",
      colModell, colEinlage, colLogo, bed, seed: seedOf(face), model_name: modelName,
      logo: logoAktiv ? { path: logoSel!.path, frame: faceL!.frame.elements, place: placeL, seed: seedOf(faceL), invert: logoInvert === "auto" ? null : logoInvert === "ja" } : null,
    });
    let st: { status: string; done?: number; total?: number; errors?: string[]; error?: string; download_url?: string } = { status: "queued" };
    const t0 = Date.now();
    for (;;) {
      await new Promise((r) => setTimeout(r, 1500));
      st = await call({ action: "status", job: init.job, slicer_id: start.slicer_id });
      setProgress({ i: st.done ?? 0, n: st.total ?? bilder.length, fehler: st.errors ?? [] });
      setStatus(st.status === "queued" ? "Wartet auf den Server …" : `Server rechnet … ${st.done ?? 0} von ${st.total ?? bilder.length}`);
      if (st.status === "done") break;
      if (st.status === "error") throw new Error(st.error || "Server meldet einen Fehler");
      if (Date.now() - t0 > 30 * 60_000) throw new Error("Zeitüberschreitung (30 Minuten)");
    }
    setStatus("Ergebnis laden …");
    const r = await fetch(st.download_url!);
    if (!r.ok) throw new Error(`Ergebnis-Download fehlgeschlagen (${r.status})`);
    const blob = await r.blob();
    call({ action: "cleanup", job: init.job }).catch(() => {});
    return blob;
  };

  const rechnen = async () => {
    if (!imgFile) return;
    setBusy(true);
    setProgress(null);
    setErr("");
    try {
      const zip = await JSZip.loadAsync(await serverJob([imgFile]));
      const find = (pred: (n: string) => boolean) => Object.values(zip.files).find((f) => !f.dir && pred(f.name));
      const fm = find((n) => n.endsWith("-modell.stl"));
      const fe = find((n) => n.endsWith("-einlage.stl") && !n.endsWith("-logo-einlage.stl"));
      const fl = find((n) => n.endsWith("-logo-einlage.stl"));
      const fehler = zip.file("FEHLER.txt") ? await zip.file("FEHLER.txt")!.async("string") : "";
      if (!fm || !fe) throw new Error(fehler.trim() || "Der Server hat kein Ergebnis geliefert.");
      const loader = new STLLoader();
      const modell = loader.parse(await fm.async("arraybuffer"));
      const einlage = loader.parse(await fe.async("arraybuffer"));
      const logo = fl ? loader.parse(await fl.async("arraybuffer")) : undefined;
      const r: EngraveResult = { modell, einlage, logo, volModell: volume(modell), volEinlage: volume(einlage), rueckfall: /voller Textk/.test(fehler) };
      if (r.volEinlage < 1e-6) setErr(fehler.trim() || "Der Text liegt nicht auf dem Modell. Position oder Fläche prüfen.");
      else { setResult(r); setShowResult(true); if (fehler.trim()) setErr(fehler.trim()); }
    } catch (e) { setErr(`Berechnung fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`); }
    setStatus("");
    setBusy(false);
  };

  const base = safeName(imgName || "gravur");
  const dlStl = (g: THREE.BufferGeometry, suffix: string) => download(new Blob([toStl(g)], { type: "model/stl" }), `${safeName(modelName)}-${base}-${suffix}.stl`);
  const dl3mf = async () => {
    if (!result) return;
    const parts = [{ name: "Modell mit Gravur", geo: result.modell, color: colModell }, { name: "Text-Einlage", geo: result.einlage, color: colEinlage }];
    if (result.logo) parts.push({ name: "Logo-Einlage", geo: result.logo, color: colLogo });
    download(await to3mf(parts, `${safeName(modelName)} ${base}`), `${safeName(modelName)}-${base}.3mf`);
  };

  const stapel = async () => {
    if (!files.length) return;
    setBusy(true);
    setErr("");
    try {
      download(await serverJob(files), `gravur-stapel-${safeName(modelName)}.zip`);
    } catch (e) { setErr(`Massenmodus fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`); }
    setStatus("");
    setBusy(false);
  };

  const bereit = !!(model && face && prep?.shapes.length && (!useLogo || !logoSel || (faceL && prepL?.shapes.length)));
  const fehlt = [!model && "Modell", model && !face && "Fläche für den Text", !prep?.shapes.length && "Bild", useLogo && logoSel && !faceL && "Fläche für das Logo"].filter(Boolean).join(", ");
  const colorBlocks: [string, string, (v: string) => void, boolean, (v: boolean) => void][] = [
    ["Modell", colModell, setColModell, showModell, setShowModell],
    ["Text-Einlage", colEinlage, setColEinlage, showEinlage, setShowEinlage],
  ];
  if (result?.logo) colorBlocks.push(["Logo-Einlage", colLogo, setColLogo, showLogo, setShowLogo]);

  return (
    <div className="mx-auto max-w-[1300px] space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-bold">Gravur-Werkzeug <span className="ml-2 rounded bg-primary/10 px-2 py-0.5 align-middle text-xs font-semibold text-primary">NEU</span></h1>
        <p className="text-sm text-muted-foreground">Bild mit Text und dein Logo werden 1:1 in ein 3D-Modell geschnitten, ohne Offset. Ergebnis: Modell mit Aussparungen und die passenden Einlagen, an Ort und Stelle. Nur im Admin sichtbar.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
        <div className="space-y-3">
          <div className="relative">
            <Viewer model={model} faces={viewFaces} overlays={overlays} places={[place, placeL]} active={layer} onActivate={setActive}
              result={result} showResult={showResult} colModell={colModell} colEinlage={colEinlage} colLogo={colLogo}
              showModell={showModell} showEinlage={showEinlage} showLogo={showLogo} bed={bed} pick={pick} onPick={onPick} onMove={(li, dx, dy) => setPlaceFor(li, { dx, dy })} api={api} />
            {!model && <div className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-muted-foreground">Zuerst ein 3D-Modell (STL oder OBJ) laden.</div>}
            {pick && model && <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"><Crosshair className="h-3.5 w-3.5" />Klicke auf die Fläche für {layer ? "das Logo" : "den Text"}</div>}
            {!pick && curFace && !result && <div className="absolute left-3 top-3 rounded-full bg-background/85 px-2.5 py-1 text-xs text-muted-foreground">Text (grün) und Logo (violett) mit der Maus verschieben</div>}
            <div className="absolute bottom-3 right-3 flex gap-1.5">
              {curFace && <button type="button" onClick={() => api.current?.lookAtFace()} className="rounded-full border bg-background/85 px-2.5 py-1 text-xs hover:bg-background">Senkrecht auf Fläche</button>}
              <button type="button" onClick={() => api.current?.fit()} className="rounded-full border bg-background/85 px-2.5 py-1 text-xs hover:bg-background">Ansicht zurücksetzen</button>
            </div>
          </div>
          {result && (
            <div className="space-y-2 rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2 text-sm font-medium"><CheckCircle2 className="h-4 w-4 text-green-600" />Fertig berechnet: Text-Einlage {(result.volEinlage / 1000).toFixed(3)} cm³, Aussparung ohne Spiel</div>
              {result.rueckfall && <div className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />Das Modell ist nicht ganz geschlossen: Die Einlage wurde als voller Textkörper von der Fläche bis zur Gravurtiefe gebaut. Bei gebogenen Flächen kann ihre Oberseite leicht vom Modell abweichen.</div>}
              <div className="grid gap-2 sm:grid-cols-2">
                {colorBlocks.map(([lbl, col, setCol, vis, setVis]) => (
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
                <Button variant="outline" onClick={() => dlStl(result.einlage, "einlage")}><Download className="mr-1.5 h-4 w-4" />Text-Einlage STL</Button>
                {result.logo && <Button variant="outline" onClick={() => dlStl(result.logo!, "logo-einlage")}><Download className="mr-1.5 h-4 w-4" />Logo-Einlage STL</Button>}
                <Button variant="ghost" onClick={() => setShowResult((v) => !v)}><Eye className="mr-1.5 h-4 w-4" />{showResult ? "Vorlage zeigen" : "Ergebnis zeigen"}</Button>
              </div>
              <p className="text-[11px] text-muted-foreground">Alle Teile liegen im selben Koordinatensystem. Im Slicer zusammen laden, dann sitzt alles an der richtigen Stelle. Die Einlagen haben keinen Offset: für die Passung ggf. im Slicer mit Toleranz drucken.</p>
            </div>
          )}
          {err && <div className="flex items-start gap-1.5 whitespace-pre-line rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{err}</div>}
        </div>

        <div className="space-y-6 rounded-xl border bg-card p-5">
          <Step n={1} title="MODELL">
            <input type="file" accept=".stl,.obj" onChange={(e) => loadModel(e.target.files?.[0])} className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1.5 file:text-sm" />
            {model && <p className="text-xs text-muted-foreground">{modelName} · {(model.getAttribute("position").count / 3).toLocaleString("de-CH")} Dreiecke (Einheit mm)</p>}
          </Step>

          <Step n={2} title="AUSRICHTFLÄCHE">
            {useLogo && logoSel && <LayerSwitch active={layer} onChange={setActive} />}
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant={pick ? "default" : "outline"} disabled={!model} onClick={() => setPick((v) => !v)}><Crosshair className="mr-1.5 h-4 w-4" />{curFace ? "Andere Fläche wählen" : `Fläche für ${layer ? "das Logo" : "den Text"} wählen`}</Button>
              {curFace && <span className="text-xs text-muted-foreground">{curFace.size.w.toFixed(1)} × {curFace.size.h.toFixed(1)} mm, {curFace.tris.length} Dreiecke</span>}
            </div>
            <label className="flex items-start gap-1.5 text-xs"><input type="checkbox" className="mt-0.5" checked={bed} onChange={(e) => setBed(e.target.checked)} /><span><b>Text-Fläche liegt beim Druck auf der Bauplatte.</b> Alle Teile werden so gedreht, dass die Text-Fläche unten liegt (z = 0), der Text wird zuerst gedruckt. Ohne Häkchen bleiben die Teile in den Koordinaten des Originals.</span></label>
            <p className="text-[11px] text-muted-foreground">Die gewählte Fläche ist die Nullebene: Oberfläche des Modells = 0, die Gravur geht senkrecht dazu nach innen. Text und Logo können auf verschiedenen Flächen liegen.</p>
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

          <Step n={4} title="LOGO (OPTIONAL)">
            <label className="flex items-center gap-1.5 text-sm font-medium"><input type="checkbox" checked={useLogo} onChange={(e) => setUseLogo(e.target.checked)} />Logo mit einbauen</label>
            {useLogo && (
              <div className="space-y-2">
                <p className="text-[11px] text-muted-foreground">Logo als PNG hochladen (am besten schwarz auf transparent oder weiss). Es wird gespeichert und steht bei jedem Auftrag wieder bereit, auch im Massenmodus.</p>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { void uploadLogo(e.target.files?.[0]); e.target.value = ""; }} className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1.5 file:text-sm" />
                {logos.length > 0 && (
                  <div className="grid grid-cols-4 gap-2">
                    {logos.map((l) => (
                      <div key={l.path} className={cn("group relative overflow-hidden rounded-md border bg-muted/40", logoSel?.path === l.path && "ring-2 ring-primary")}>
                        <button type="button" onClick={() => void selectLogo(l)} title={l.name} className="block aspect-square w-full p-1"><img src={l.url} alt={l.name} className="h-full w-full object-contain" /></button>
                        <button type="button" aria-label={`${l.name} löschen`} onClick={() => void deleteLogo(l)} className="absolute right-0.5 top-0.5 hidden h-5 w-5 place-items-center rounded-full bg-background/90 text-xs text-destructive group-hover:grid">×</button>
                        <div className="truncate px-1 pb-0.5 text-center text-[10px] text-muted-foreground">{l.name}</div>
                      </div>
                    ))}
                  </div>
                )}
                {logoSel && (
                  <div className="space-y-1 text-xs">
                    <div className="text-muted-foreground">Gewählt: <b>{logoSel.name}</b>{prepL ? ` · ${prepL.loops} Konturen` : ""}</div>
                    <label className="flex items-center gap-1.5">Logo ist <select value={logoInvert} onChange={(e) => setLogoInvert(e.target.value as typeof logoInvert)} className="rounded border bg-background px-1.5 py-0.5"><option value="auto">automatisch</option><option value="nein">kleinere Fläche</option><option value="ja">umgekehrt</option></select></label>
                    {!faceL && <div className="text-primary">Jetzt oben bei «Ausrichtfläche» auf «Logo» umschalten und die Fläche für das Logo wählen.</div>}
                  </div>
                )}
              </div>
            )}
          </Step>

          <Step n={5} title="POSITION UND GRÖSSE">
            {useLogo && logoSel && <LayerSwitch active={layer} onChange={setActive} />}
            <Num label={layer ? "Breite des Logos" : "Breite des Bildes"} unit="mm" value={curPlace.widthMm} min={2} max={Math.max(100, Math.round((curFace?.size.w ?? 100) * 1.5))} step={0.5} onChange={(v) => setP({ widthMm: Math.max(1, v) })} />
            <Num label="Verschieben X" unit="mm" value={curPlace.dx} min={-Math.max(50, curFace?.size.w ?? 50)} max={Math.max(50, curFace?.size.w ?? 50)} step={0.1} onChange={(v) => setP({ dx: v })} />
            <Num label="Verschieben Y" unit="mm" value={curPlace.dy} min={-Math.max(50, curFace?.size.h ?? 50)} max={Math.max(50, curFace?.size.h ?? 50)} step={0.1} onChange={(v) => setP({ dy: v })} />
            <Num label="Drehen" unit="°" value={curPlace.rotDeg} min={-180} max={180} step={0.5} onChange={(v) => setP({ rotDeg: v })} />
            <Num label="Gravurtiefe" unit="mm" value={curPlace.depth} min={0.1} max={10} step={0.05} onChange={(v) => setP({ depth: Math.max(0.05, v) })} />
            <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={curPlace.centerInk} onChange={(e) => setP({ centerInk: e.target.checked })} />Mitte {layer ? "des Logos" : "des Textes"} statt Bildmitte als Ankerpunkt</label>
            <Button variant="ghost" size="sm" onClick={() => { if (layer) { setTouchedL(false); setPlaceL({ ...LOGO_PLACE }); } else { setTouched(false); setPlace({ ...DEFAULT_PLACE }); } }}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Zurücksetzen</Button>
          </Step>

          <Step n={6} title="BERECHNEN">
            <Button className="w-full" disabled={!bereit || !imgFile || busy} onClick={rechnen}>
              {busy && !batch ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Scissors className="mr-1.5 h-4 w-4" />}Ausschneiden
            </Button>
            {status && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />{status}</p>}
            <p className="text-[11px] text-muted-foreground">Gerechnet wird auf dem Server (muscio): saubere Kurven mit Potrace, Schnitt direkt in die ebene Fläche.</p>
            {!bereit && <p className="text-[11px] text-muted-foreground">Es fehlen noch: {fehlt}.</p>}
          </Step>

          <Step n={7} title="MASSENMODUS">
            <label className="flex items-center gap-1.5 text-sm font-medium"><input type="checkbox" checked={batch} onChange={(e) => setBatch(e.target.checked)} /><Package className="h-4 w-4" />Viele Bilder auf dasselbe Modell anwenden</label>
            {batch && (
              <div className="space-y-2">
                <p className="text-[11px] text-muted-foreground">Fläche, Breite, Position, Drehung und Tiefe aus den Einstellungen oben gelten für alle Bilder. Jedes Bild wird auf dieselbe Rahmenbreite gebracht und an derselben Stelle ausgerichtet. Für Bilder mit unterschiedlich langem Text oben «Mitte des Textes» aktivieren.{logoAktiv ? " Das gewählte Logo wird bei jedem Bild an derselben Stelle mit eingebaut." : ""}</p>
                <input type="file" accept="image/*" multiple onChange={(e) => setFiles([...(e.target.files ?? [])])} className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1.5 file:text-sm" />
                {files.length > 0 && <p className="text-xs text-muted-foreground">{files.length} Bilder gewählt</p>}
                <Button className="w-full" variant="outline" disabled={!modelFile || !face || !files.length || busy || (useLogo && !!logoSel && !logoAktiv)} onClick={stapel}>
                  {busy && batch ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Package className="mr-1.5 h-4 w-4" />}Alle berechnen (ZIP)
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
