import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

interface Rotation { x: number; y: number; z: number; px?: number; py?: number; pz?: number }
export default function ModelViewer({ url, rotation, showAxes }: { url: string; rotation?: Rotation; showAxes?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<THREE.Object3D | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 5000);
    camera.position.set(0, 0, 200);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(renderer.domElement);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(2, 4, 3);
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(-2, 1, -1);
    scene.add(fillLight);

    const groundLight = new THREE.DirectionalLight(0xffffff, 0.15);
    groundLight.position.set(0, -1, 0);
    scene.add(groundLight);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    if (showAxes) {
      const mkAxis = (a: [number, number, number], b: [number, number, number], color: number) => {
        const geom = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(...a),
          new THREE.Vector3(...b),
        ]);
        return new THREE.Line(geom, new THREE.LineBasicMaterial({ color }));
      };
      scene.add(mkAxis([-150, 0, 0], [150, 0, 0], 0xff0000));
      scene.add(mkAxis([0, -150, 0], [0, 150, 0], 0x00ff00));
      scene.add(mkAxis([0, 0, -150], [0, 0, 150], 0x0000ff));
    }

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.8;
    controls.enablePan = false;
    controls.enableZoom = false;

    let root: THREE.Object3D | null = null;
    let stopped = false;

    const onUserInteract = () => { controls.autoRotate = false; };
    renderer.domElement.addEventListener("pointerdown", onUserInteract);

    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        root = gltf.scene;
        rootRef.current = root;
        if (rotation) {
          root.rotation.set(rotation.x * Math.PI / 180, rotation.y * Math.PI / 180, rotation.z * Math.PI / 180);
        } else {
          root.rotation.x = -Math.PI / 2;
        }
        const box = new THREE.Box3().setFromObject(root);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        root.position.sub(center);
        if (rotation) {
          root.position.x += rotation.px || 0;
          root.position.y += rotation.py || 0;
          root.position.z += rotation.pz || 0;
        }
        scene.add(root);

        const shadowBox = new THREE.Box3().setFromObject(gltf.scene);
        const shadowSize = shadowBox.getSize(new THREE.Vector3());
        const shadowCenter = shadowBox.getCenter(new THREE.Vector3());
        const shadowRadius = Math.max(shadowSize.x, shadowSize.z) * 0.55;

        const shadows = [
          { radius: shadowRadius * 1.0, opacity: 0.12, scale: 1.0 },
          { radius: shadowRadius * 0.7, opacity: 0.08, scale: 0.8 },
          { radius: shadowRadius * 0.4, opacity: 0.06, scale: 0.5 },
        ];

        shadows.forEach(({ radius, opacity, scale }) => {
          const geo = new THREE.CircleGeometry(radius, 64);
          const mat = new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity,
            depthWrite: false,
          });
          const mesh = new THREE.Mesh(geo, mat);
          mesh.rotation.x = -Math.PI / 2;
          mesh.position.set(shadowCenter.x, shadowBox.min.y + 0.01, shadowCenter.z);
          mesh.scale.set(scale, 1, scale);
          scene.add(mesh);
        });

        const maxDim = Math.max(size.x, size.y, size.z);
        camera.position.set(0, maxDim * 0.5, maxDim * 2);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        controls.update();
        // store base center offset for re-applying position
        (root as any).__baseOffset = center.clone();
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
  }, [url, showAxes]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !rotation) return;
    root.rotation.set(
      rotation.x * Math.PI / 180,
      rotation.y * Math.PI / 180,
      rotation.z * Math.PI / 180,
    );
    const base = (root as any).__baseOffset as THREE.Vector3 | undefined;
    if (base) {
      root.position.set(-base.x + (rotation.px || 0), -base.y + (rotation.py || 0), -base.z + (rotation.pz || 0));
    }
  }, [rotation?.x, rotation?.y, rotation?.z, rotation?.px, rotation?.py, rotation?.pz]);

  return <div ref={containerRef} className="w-full h-full min-h-[400px]" />;
}
