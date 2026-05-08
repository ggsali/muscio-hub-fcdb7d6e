import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export default function ModelViewer({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111315);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 5000);
    camera.position.set(0, 0, 200);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(120, 180, 200);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xff8a3d, 0.35);
    fill.position.set(-150, -80, 80);
    scene.add(fill);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.8;
    controls.enablePan = false;

    let root: THREE.Object3D | null = null;
    let stopped = false;

    const onUserInteract = () => { controls.autoRotate = false; };
    renderer.domElement.addEventListener("pointerdown", onUserInteract);

    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        root = gltf.scene;
        // Modell aufrecht stellen (falls auf der Seite liegend)
        root.rotation.x = -Math.PI / 2;
        // Bounding Box nach Rotation berechnen
        const box = new THREE.Box3().setFromObject(root);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        // Modell zentrieren
        root.position.sub(center);
        scene.add(root);
        // Kamera so positionieren, dass Modell vollständig sichtbar ist
        const maxDim = Math.max(size.x, size.y, size.z);
        camera.position.set(0, maxDim * 0.5, maxDim * 2);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        controls.update();
      },
      undefined,
      (err) => console.error("GLB load failed", err),
    );

    const animate = () => {
      if (stopped) return;
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      stopped = true;
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("pointerdown", onUserInteract);
      controls.dispose();
      renderer.dispose();
      if (root) {
        root.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
          if (mesh.material) {
            const m = mesh.material as THREE.Material | THREE.Material[];
            if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
            else m.dispose();
          }
        });
      }
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [url]);

  return <div ref={containerRef} className="w-full h-full min-h-[400px]" />;
}
