import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Button } from "@/components/ui/button";

export type ModelInfo = { triangles: number; size: [number, number, number] };

/** Einfacher 3D-Betrachter für STL/GLB (Testseite). Drehen mit der Maus, Zoomen mit dem Rad. */
export default function ModelViewer3D({ data, kind, onInfo }: { data: ArrayBuffer; kind: "stl" | "glb"; onInfo?: (i: ModelInfo) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [zUp, setZUp] = useState(false);
  const rootRef = useRef<THREE.Object3D | null>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const w = el.clientWidth || 600, h = el.clientHeight || 460;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, w / h, 0.01, 10000);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x555566, 1.1));
    const dl = new THREE.DirectionalLight(0xffffff, 1.4); dl.position.set(3, 5, 4); scene.add(dl);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    let root: THREE.Object3D;
    if (kind === "stl") {
      const g = new STLLoader().parse(data);
      g.computeVertexNormals();
      root = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xc8ccd4, roughness: 0.6, metalness: 0.05 }));
    } else {
      // GLB synchron aus dem Puffer parsen
      root = new THREE.Group();
      new GLTFLoader().parse(data, "", (gltf) => { root.add(gltf.scene); fit(); }, () => {});
    }
    const holder = new THREE.Group();
    holder.add(root);
    scene.add(holder);
    rootRef.current = holder;

    function fit() {
      const box = new THREE.Box3().setFromObject(holder);
      if (box.isEmpty()) return;
      const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
      root.position.sub(c);
      const r = Math.max(size.x, size.y, size.z) || 1;
      camera.position.set(r * 1.6, r * 1.1, r * 1.9);
      camera.near = r / 100; camera.far = r * 100; camera.updateProjectionMatrix();
      controls.target.set(0, 0, 0); controls.update();
      let tri = 0;
      holder.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { const g = m.geometry; tri += (g.index ? g.index.count : g.attributes.position.count) / 3; } });
      onInfo?.({ triangles: Math.round(tri), size: [size.x, size.y, size.z] });
    }
    if (kind === "stl") fit();

    let raf = 0;
    const loop = () => { raf = requestAnimationFrame(loop); controls.update(); renderer.render(scene, camera); };
    loop();
    const onResize = () => { const nw = el.clientWidth, nh = el.clientHeight; renderer.setSize(nw, nh); camera.aspect = nw / nh; camera.updateProjectionMatrix(); };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf); window.removeEventListener("resize", onResize);
      controls.dispose(); renderer.dispose(); el.removeChild(renderer.domElement);
      scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose?.(); } });
    };
  }, [data, kind]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (rootRef.current) rootRef.current.rotation.x = zUp ? -Math.PI / 2 : 0; }, [zUp, data]);

  return (
    <div className="relative">
      <div ref={host} className="h-[460px] w-full overflow-hidden rounded-lg border bg-muted/40" />
      <Button type="button" size="sm" variant="outline" className="absolute right-2 top-2 h-7 text-xs" onClick={() => setZUp((v) => !v)}>
        {zUp ? "Z-oben aus" : "Z-oben (aufrichten)"}
      </Button>
    </div>
  );
}
