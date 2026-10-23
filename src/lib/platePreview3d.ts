import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

// 3D-Ansicht einer Druckplatte (Teile liegen auf dem Druckbett), als Szene für Vorschau und PDF-Bild.
export async function loadPlateGeometry(blob: Blob): Promise<THREE.BufferGeometry> {
  const g = new STLLoader().parse(await blob.arrayBuffer());
  g.computeVertexNormals();
  return g;
}

export function buildPlateScene(geo: THREE.BufferGeometry, bed: { x: number; y: number }, hex: string, dark = false) {
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  // Bett (x/y), z nach oben -> für die Anzeige Y-up: Rotation um -90° um X
  const plate = new THREE.Mesh(new THREE.BoxGeometry(bed.x, bed.y, 2), new THREE.MeshStandardMaterial({ color: dark ? 0x2b3138 : 0xdfe3e8, roughness: 0.9 }));
  plate.position.set(bed.x / 2, bed.y / 2, -1);
  root.add(plate);
  const grid = new THREE.GridHelper(Math.max(bed.x, bed.y), Math.round(Math.max(bed.x, bed.y) / 20), dark ? 0x4a525c : 0xaab1ba, dark ? 0x3a4149 : 0xc4cad1);
  grid.rotation.x = Math.PI / 2; grid.position.set(bed.x / 2, bed.y / 2, 0.05);
  root.add(grid);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: 0.55, metalness: 0.05 }));
  root.add(mesh);
  root.rotation.x = -Math.PI / 2;
  root.position.set(-bed.x / 2, 0, bed.y / 2);
  scene.add(root);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x778899, 1.0));
  const dl = new THREE.DirectionalLight(0xffffff, 1.4);
  dl.position.set(bed.x, bed.x * 1.2, bed.y);
  scene.add(dl);
  const camera = new THREE.PerspectiveCamera(35, 1, 1, 5000);
  const d = Math.max(bed.x, bed.y) * 2.6;
  camera.position.set(0, d * 0.75, d * 0.65);
  camera.lookAt(0, 0, 0);
  return { scene, camera };
}

/** Rendert die Platte als PNG (Data-URL) für das Auftragsblatt. */
export async function renderPlatePng(blob: Blob, bed: { x: number; y: number }, hex: string, size = 700): Promise<string | null> {
  try {
    const geo = await loadPlateGeometry(blob);
    const { scene, camera } = buildPlateScene(geo, bed, hex);
    const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
    r.setPixelRatio(1); r.setSize(size, size); r.setClearColor(0xffffff, 1);
    r.render(scene, camera);
    const url = r.domElement.toDataURL("image/png");
    r.dispose(); geo.dispose();
    return url;
  } catch (e) {
    console.warn("Plattenbild fehlgeschlagen", e);
    return null;
  }
}
