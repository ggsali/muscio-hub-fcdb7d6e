import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { buildPlateScene, loadPlateGeometry } from "@/lib/platePreview3d";

// Interaktive 3D-Ansicht einer Druckplatte (drehen mit linker Maustaste, zoomen mit dem Mausrad).
export default function PlateViewer3D({ blob, bed, hex }: { blob: Blob; bed: { x: number; y: number }; hex: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let stop = false, raf = 0;
    let cleanup = () => {};
    (async () => {
      const geo = await loadPlateGeometry(blob);
      if (stop) { geo.dispose(); return; }
      const dark = document.documentElement.classList.contains("dark") || window.matchMedia("(prefers-color-scheme: dark)").matches;
      const { scene, camera } = buildPlateScene(geo, bed, hex, dark);
      const r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      el.appendChild(r.domElement);
      const controls = new OrbitControls(camera, r.domElement);
      controls.enableDamping = true;
      controls.maxPolarAngle = Math.PI / 2 - 0.05;
      controls.minDistance = 40;
      controls.maxDistance = Math.max(bed.x, bed.y) * 4;
      const resize = () => {
        const w = el.clientWidth, h = el.clientHeight;
        r.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
      };
      resize();
      const ro = new ResizeObserver(resize); ro.observe(el);
      const loop = () => { controls.update(); r.render(scene, camera); raf = requestAnimationFrame(loop); };
      loop();
      cleanup = () => { cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); r.dispose(); geo.dispose(); r.domElement.remove(); };
    })();
    return () => { stop = true; cleanup(); };
  }, [blob, bed.x, bed.y, hex]);
  return <div ref={ref} className="h-64 w-full overflow-hidden rounded-lg border bg-muted/30" />;
}
