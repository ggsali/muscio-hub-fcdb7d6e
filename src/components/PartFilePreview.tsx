import { useEffect, useRef, useState } from "react";
import { Box } from "lucide-react";

type Format = "stl" | "obj" | "3mf" | "step" | "other";

function getFormat(name: string): Format {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "stl") return "stl";
  if (ext === "obj") return "obj";
  if (ext === "3mf") return "3mf";
  if (ext === "step" || ext === "stp") return "step";
  return "other";
}

/** Kleine 3D-Vorschau für Modell-Dateien (aus einer URL, z. B. Signed URL). */
export default function PartFilePreview({ url, filename }: { url: string; filename: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [format] = useState<Format>(() => getFormat(filename));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (format === "step" || format === "other") return;
    const container = containerRef.current;
    if (!container) return;

    let stopped = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      const THREE = await import("three");
      const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
      if (stopped) return;

      const width = container.clientWidth || 120;
      const height = container.clientHeight || 120;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(width, height);
      renderer.setClearColor(0x000000, 0);
      container.appendChild(renderer.domElement);

      scene.add(new THREE.AmbientLight(0xffffff, 0.7));
      const dir = new THREE.DirectionalLight(0xffffff, 1.1);
      dir.position.set(60, 120, 100);
      scene.add(dir);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 1.4;
      controls.enablePan = false;

      let added: any = null;

      const frameObject = (obj: any) => {
        const box = new THREE.Box3().setFromObject(obj);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        obj.position.sub(center);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        camera.position.set(maxDim * 0.9, maxDim * 0.8, maxDim * 1.4);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        controls.update();
      };

      const material = () =>
        new THREE.MeshStandardMaterial({ color: 0xff5a00, metalness: 0.2, roughness: 0.6 });

      const applyMaterial = (obj: any) => {
        obj.traverse((child: any) => {
          if (child.isMesh) child.material = material();
        });
      };

      const onErr = (e: unknown) => {
        console.warn("Vorschau fehlgeschlagen", e);
        setFailed(true);
      };

      if (format === "stl") {
        const { STLLoader } = await import("three/examples/jsm/loaders/STLLoader.js");
        new STLLoader().load(
          url,
          (geometry) => {
            geometry.computeVertexNormals();
            const mesh = new THREE.Mesh(geometry, material());
            frameObject(mesh);
            scene.add(mesh);
            added = mesh;
          },
          undefined,
          onErr,
        );
      } else if (format === "obj") {
        const { OBJLoader } = await import("three/examples/jsm/loaders/OBJLoader.js");
        new OBJLoader().load(
          url,
          (obj) => {
            applyMaterial(obj);
            frameObject(obj);
            scene.add(obj);
            added = obj;
          },
          undefined,
          onErr,
        );
      } else if (format === "3mf") {
        const { ThreeMFLoader } = await import("three/examples/jsm/loaders/3MFLoader.js");
        new ThreeMFLoader().load(
          url,
          (obj) => {
            applyMaterial(obj);
            frameObject(obj);
            scene.add(obj);
            added = obj;
          },
          undefined,
          onErr,
        );
      }

      const animate = () => {
        if (stopped) return;
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      };
      animate();

      cleanup = () => {
        controls.dispose();
        renderer.dispose();
        if (added) {
          added.traverse?.((child: any) => {
            if (child.isMesh) {
              child.geometry?.dispose();
              const mat = child.material;
              Array.isArray(mat) ? mat.forEach((m: any) => m.dispose()) : mat?.dispose();
            }
          });
        }
        if (renderer.domElement.parentNode === container) {
          container.removeChild(renderer.domElement);
        }
      };
    })();

    return () => {
      stopped = true;
      cleanup?.();
    };
  }, [url, format]);

  if (format === "step" || format === "other" || failed) {
    return (
      <div className="w-full h-full rounded-md bg-muted flex flex-col items-center justify-center gap-1 p-1">
        <Box className="w-6 h-6 text-primary" />
        <span className="text-[9px] text-muted-foreground text-center leading-tight">
          {format === "step" ? "STEP – keine Vorschau" : "Keine Vorschau"}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      className="w-full h-full select-none"
    />
  );
}
