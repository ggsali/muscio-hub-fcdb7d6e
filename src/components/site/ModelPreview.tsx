import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js";
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

export default function ModelPreview({ file }: { file: File }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [format] = useState<Format>(() => getFormat(file.name));

  useEffect(() => {
    if (format === "step" || format === "other") return;
    const container = containerRef.current;
    if (!container) return;

    const objectUrl = URL.createObjectURL(file);
    const width = container.clientWidth || 150;
    const height = container.clientHeight || 150;

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 5000);
    camera.position.set(0, 0, 200);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(50, 100, 80);
    scene.add(dir);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.2;
    controls.enablePan = false;
    controls.enableZoom = false;

    let added: THREE.Object3D | null = null;
    let stopped = false;

    const frameObject = (obj: THREE.Object3D) => {
      const box = new THREE.Box3().setFromObject(obj);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      obj.position.sub(center);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      camera.position.set(0, maxDim * 0.5, maxDim * 1.8);
      camera.lookAt(0, 0, 0);
      controls.target.set(0, 0, 0);
      controls.update();
    };

    const applyMaterial = (obj: THREE.Object3D) => {
      obj.traverse((child) => {
        const m = child as THREE.Mesh;
        if (m.isMesh) {
          m.material = new THREE.MeshStandardMaterial({
            color: 0x22c55e,
            metalness: 0.1,
            roughness: 0.7,
          });
        }
      });
    };

    const onErr = (err: unknown) => console.warn("Model preview load failed", err);

    if (format === "stl") {
      const loader = new STLLoader();
      loader.load(
        objectUrl,
        (geometry) => {
          geometry.computeVertexNormals();
          const material = new THREE.MeshStandardMaterial({
            color: 0x22c55e,
            metalness: 0.1,
            roughness: 0.8,
          });
          const mesh = new THREE.Mesh(geometry, material);
          frameObject(mesh);
          scene.add(mesh);
          added = mesh;
        },
        undefined,
        onErr,
      );
    } else if (format === "obj") {
      const loader = new OBJLoader();
      loader.load(
        objectUrl,
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
      const loader = new ThreeMFLoader();
      loader.load(
        objectUrl,
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

    return () => {
      stopped = true;
      controls.dispose();
      renderer.dispose();
      if (added) {
        added.traverse((child) => {
          const m = child as THREE.Mesh;
          if (m.isMesh) {
            m.geometry?.dispose();
            const mat = m.material as THREE.Material | THREE.Material[];
            if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
            else mat?.dispose();
          }
        });
      }
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      URL.revokeObjectURL(objectUrl);
    };
  }, [file, format]);

  if (format === "step") {
    return (
      <div className="w-full h-full rounded-xl bg-muted flex flex-col items-center justify-center gap-1 p-2">
        <Box className="w-10 h-10 text-primary" />
        <span className="text-xs text-muted-foreground">STEP-Datei</span>
        <span className="text-[10px] text-muted-foreground text-center">Vorschau nicht verfügbar</span>
      </div>
    );
  }

  if (format === "other") {
    return (
      <div className="w-full h-full rounded-xl bg-muted flex items-center justify-center">
        <Box className="w-10 h-10 text-muted-foreground" />
      </div>
    );
  }

  return <div ref={containerRef} className="w-full h-full" />;
}
