import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export default function ModellViewer({ geo, size, color }: { geo: THREE.BufferGeometry; size: number; color: string }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = el.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(45, host.clientWidth / host.clientHeight, 1, size * 20);
    cam.up.set(0, 0, 1);
    cam.position.set(0, -size * 1.1, size * 0.9);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(size, -size, size * 2);
    scene.add(sun);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
    scene.add(new THREE.Mesh(geo, mat));
    const controls = new OrbitControls(cam, renderer.domElement);
    controls.enableDamping = true;
    let raf = 0;
    const loop = () => { controls.update(); renderer.render(scene, cam); raf = requestAnimationFrame(loop); };
    loop();
    const ro = new ResizeObserver(() => {
      cam.aspect = host.clientWidth / host.clientHeight; cam.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight);
    });
    ro.observe(host);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); mat.dispose(); renderer.dispose(); host.removeChild(renderer.domElement); };
  }, [geo, size, color]);
  return <div ref={el} className="h-full w-full" />;
}
