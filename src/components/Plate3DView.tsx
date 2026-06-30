import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, ThreeEvent, useLoader } from "@react-three/fiber";
import { OrbitControls, Grid, Html } from "@react-three/drei";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export interface Plate3DPlacement {
  key: string; // unique id (partId+copy)
  partId: string;
  copy: number;
  x: number; // mm, top-left in mm coordinate system
  y: number;
  w: number;
  h: number;
  fits: boolean;
}

interface Props {
  plateW: number;
  plateH: number;
  placements: Plate3DPlacement[];
  onMove: (key: string, x: number, y: number) => void;
}

const PART_URL_CACHE = new Map<string, string>();

async function getStlUrl(partId: string): Promise<string | null> {
  if (PART_URL_CACHE.has(partId)) return PART_URL_CACHE.get(partId)!;
  const { data: files } = await supabase
    .from("part_files")
    .select("storage_path, filename")
    .eq("part_id", partId);
  const stl = (files || []).find((f: any) => (f.filename || "").toLowerCase().endsWith(".stl"));
  if (!stl) return null;
  const { data } = await supabase.storage
    .from("part-files")
    .createSignedUrl(stl.storage_path, 60 * 60);
  if (!data?.signedUrl) return null;
  PART_URL_CACHE.set(partId, data.signedUrl);
  return data.signedUrl;
}

function PartMesh({
  placement,
  url,
  plateW,
  plateH,
  onMove,
}: {
  placement: Plate3DPlacement;
  url: string;
  plateW: number;
  plateH: number;
  onMove: (key: string, x: number, y: number) => void;
}) {
  const geometry = useLoader(STLLoader, url) as THREE.BufferGeometry;
  const groupRef = useRef<THREE.Group>(null);
  const dragRef = useRef<{ offsetX: number; offsetZ: number } | null>(null);
  const [hovered, setHovered] = useState(false);

  // Center geometry on origin in XY, sit on Z=0
  const centered = useMemo(() => {
    const g = geometry.clone();
    g.computeBoundingBox();
    const bb = g.boundingBox!;
    const cx = (bb.max.x + bb.min.x) / 2;
    const cy = (bb.max.y + bb.min.y) / 2;
    g.translate(-cx, -cy, -bb.min.z);
    g.computeVertexNormals();
    return g;
  }, [geometry]);

  // Convert plate coordinates (top-left x,y in mm with origin at plate corner)
  // into three.js scene coords: plate centered at origin, X to the right, Z forward.
  // We use Y-up: build plate on XZ plane. Mapping: sceneX = x + w/2 - plateW/2,
  // sceneZ = y + h/2 - plateH/2.
  const sx = placement.x + placement.w / 2 - plateW / 2;
  const sz = placement.y + placement.h / 2 - plateH / 2;

  return (
    <group
      ref={groupRef}
      position={[sx, 0, sz]}
      rotation={[-Math.PI / 2, 0, 0]} // STL Z-up -> our Y-up; lay flat
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "grab";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "";
      }}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        dragRef.current = {
          offsetX: e.point.x - sx,
          offsetZ: e.point.z - sz,
        };
        document.body.style.cursor = "grabbing";
      }}
      onPointerMove={(e: ThreeEvent<PointerEvent>) => {
        if (!dragRef.current) return;
        e.stopPropagation();
        const newSx = e.point.x - dragRef.current.offsetX;
        const newSz = e.point.z - dragRef.current.offsetZ;
        // back to plate coordinates
        let newX = newSx - placement.w / 2 + plateW / 2;
        let newY = newSz - placement.h / 2 + plateH / 2;
        // clamp to plate
        newX = Math.max(0, Math.min(plateW - placement.w, newX));
        newY = Math.max(0, Math.min(plateH - placement.h, newY));
        onMove(placement.key, newX, newY);
      }}
      onPointerUp={(e: ThreeEvent<PointerEvent>) => {
        dragRef.current = null;
        document.body.style.cursor = hovered ? "grab" : "";
      }}
    >
      <mesh geometry={centered} castShadow receiveShadow>
        <meshStandardMaterial
          color={placement.fits ? (hovered ? "#ff7a30" : "#ff5a00") : "#dc2626"}
          metalness={0.1}
          roughness={0.6}
        />
      </mesh>
    </group>
  );
}

function PlateBase({ w, h }: { w: number; h: number }) {
  return (
    <group>
      {/* Plate slab */}
      <mesh position={[0, -1, 0]} receiveShadow>
        <boxGeometry args={[w, 2, h]} />
        <meshStandardMaterial color="#1f1f23" metalness={0.2} roughness={0.8} />
      </mesh>
      {/* Build area outline */}
      <Grid
        position={[0, 0.01, 0]}
        args={[w, h]}
        cellSize={10}
        cellThickness={0.5}
        cellColor="#3a3a3f"
        sectionSize={50}
        sectionThickness={1}
        sectionColor="#ff5a00"
        fadeDistance={Math.max(w, h) * 2}
        fadeStrength={1}
        infiniteGrid={false}
      />
    </group>
  );
}

export default function Plate3DView({ plateW, plateH, placements, onMove }: Props) {
  const [urls, setUrls] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const ids = Array.from(new Set(placements.map((p) => p.partId)));
    const missing = ids.filter((id) => !(id in urls));
    if (missing.length === 0) return;
    setLoading(true);
    Promise.all(missing.map(async (id) => [id, await getStlUrl(id)] as const)).then((pairs) => {
      if (cancelled) return;
      setUrls((prev) => {
        const next = { ...prev };
        for (const [id, url] of pairs) next[id] = url;
        return next;
      });
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [placements]);

  const maxDim = Math.max(plateW, plateH, 100);
  const camDist = maxDim * 1.4;

  return (
    <div className="relative w-full h-[480px] rounded-lg overflow-hidden border border-border bg-[#0a0a0c]">
      {loading && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 text-xs text-muted-foreground bg-card/80 px-2 py-1 rounded">
          <Loader2 className="w-3 h-3 animate-spin" /> STL laden…
        </div>
      )}
      <div className="absolute top-2 left-2 z-10 text-[10px] text-muted-foreground bg-card/80 px-2 py-1 rounded">
        Linksklick + ziehen = Teil verschieben · Rechtsklick = Kamera drehen · Scroll = Zoom
      </div>
      <Canvas
        shadows
        camera={{ position: [camDist * 0.6, camDist * 0.8, camDist * 0.6], fov: 40, near: 1, far: maxDim * 10 }}
      >
        <color attach="background" args={["#0a0a0c"]} />
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[maxDim, maxDim * 1.5, maxDim * 0.5]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <PlateBase w={plateW} h={plateH} />
        {placements.map((p) =>
          urls[p.partId] ? (
            <PartMesh
              key={p.key}
              placement={p}
              url={urls[p.partId]!}
              plateW={plateW}
              plateH={plateH}
              onMove={onMove}
            />
          ) : null,
        )}
        <OrbitControls
          makeDefault
          mouseButtons={{
            LEFT: undefined as any, // disable left-click camera so drag works on parts
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.ROTATE,
          }}
          enablePan
          enableZoom
          target={[0, 0, 0]}
        />
      </Canvas>
    </div>
  );
}
