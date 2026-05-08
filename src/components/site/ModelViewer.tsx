import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";

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

    const ext = url.split('.').pop()?.toLowerCase().split('?')[0];

    if (ext === '3mf' || ext === 'obj') {
      const loader = ext === 'obj' ? new OBJLoader() : new ThreeMFLoader();
      loader.load(url, (obj) => {
        obj.traverse((child) => {
          const m = child as THREE.Mesh;
          if (m.isMesh && (!m.material || Array.isArray(m.material))) {
            m.material = new THREE.MeshStandardMaterial({
              color: 0xcccccc,
              metalness: 0.1,
              roughness: 0.7,
            });
          }
        });
        const box = new THREE.Box3().setFromObject(obj);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        obj.position.x = -center.x;
        obj.position.z = -center.z;
        obj.position.y = -box.min.y;
        const maxDim = Math.max(size.x, size.y, size.z);
        camera.position.set(maxDim * 1.2, size.y * 0.8, maxDim * 1.5);
        camera.lookAt(0, size.y * 0.3, 0);
        controls.target.set(0, size.y * 0.3, 0);
        controls.update();
        scene.add(obj);
      });
    } else {
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
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        gltf.scene.position.x = -center.x;
        gltf.scene.position.z = -center.z;
        gltf.scene.position.y = -box.min.y;
        if (rotation) {
          gltf.scene.position.x += rotation.px || 0;
          gltf.scene.position.y += rotation.py || 0;
          gltf.scene.position.z += rotation.pz || 0;
        }
        scene.add(root);

        const box2 = new THREE.Box3().setFromObject(gltf.scene);
        const size2 = box2.getSize(new THREE.Vector3());

        const shadowCanvas = document.createElement('canvas');
        shadowCanvas.width = 512;
        shadowCanvas.height = 512;
        const ctx = shadowCanvas.getContext('2d')!;

        const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
        gradient.addColorStop(0,    'rgba(0, 0, 0, 0.45)');
        gradient.addColorStop(0.15, 'rgba(0, 0, 0, 0.35)');
        gradient.addColorStop(0.35, 'rgba(0, 0, 0, 0.20)');
        gradient.addColorStop(0.55, 'rgba(0, 0, 0, 0.10)');
        gradient.addColorStop(0.75, 'rgba(0, 0, 0, 0.03)');
        gradient.addColorStop(0.90, 'rgba(0, 0, 0, 0.01)');
        gradient.addColorStop(1.0,  'rgba(0, 0, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 512, 512);

        const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
        const shadowGeo = new THREE.PlaneGeometry(1, 1);
        const shadowMat = new THREE.MeshBasicMaterial({
          map: shadowTexture,
          transparent: true,
          depthWrite: false,
          opacity: 1,
        });
        const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
        shadowMesh.rotation.x = -Math.PI / 2;
        shadowMesh.position.set(0, 0.02, 0);

        const shadowSize = Math.max(size2.x, size2.z) * 1.4;
        shadowMesh.scale.set(shadowSize, shadowSize, 1);
        scene.add(shadowMesh);

        const maxDim = Math.max(size2.x, size2.y, size2.z);
        const height = size2.y;
        camera.position.set(maxDim * 1.2, height * 0.8, maxDim * 1.5);
        camera.lookAt(0, height * 0.3, 0);
        controls.target.set(0, height * 0.3, 0);
        controls.update();
        // store base offset for re-applying position
        (root as any).__baseOffset = new THREE.Vector3(center.x, box.min.y, center.z);
      },
      undefined,
      (err) => console.error("GLB load failed", err),
    );
    }

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
