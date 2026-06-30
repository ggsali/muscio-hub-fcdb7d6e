import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Layers, Plus, Trash2, Download, Loader2, AlertCircle, RotateCw, X,
  Move, Maximize2,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

type GizmoMode = "translate" | "rotate";

type Part = {
  id: string;
  teilname: string;
  laenge_mm: number | null;
  breite_mm: number | null;
};
type Printer = {
  id: string;
  name: string;
  bauplatte_breite_mm: number | null;
  bauplatte_tiefe_mm: number | null;
};
type Plate = {
  id: string;
  name: string;
  equipment_id: string | null;
  status: string;
  created_at: string;
};
type Placement = {
  id: string;
  plate_id: string;
  part_id: string;
  menge: number;
  pos_x_mm: number;
  pos_y_mm: number;
  rot_deg: number;
};

const PART_HEIGHT_MM = 20;

export default function PlattenPlanerPage() {
  const { id: orderId } = useParams<{ id: string }>();
  const { toast } = useToast();

  const [order, setOrder] = useState<any>(null);
  const [parts, setParts] = useState<Part[]>([]);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [plates, setPlates] = useState<Plate[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [activePlateId, setActivePlateId] = useState<string | null>(null);
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [zipping, setZipping] = useState(false);
  const [showNewPlate, setShowNewPlate] = useState(false);
  const [newPlatePrinterId, setNewPlatePrinterId] = useState("");
  const [dragOverCanvas, setDragOverCanvas] = useState(false);
  const [tabDragOverId, setTabDragOverId] = useState<string | null>(null);
  const [hoverTip, setHoverTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [gizmoMode, setGizmoMode] = useState<GizmoMode>("translate");

  // ====== DATA LOAD ======
  const loadAll = async () => {
    if (!orderId) return;
    setLoading(true);
    const [o, p, eq, pl] = await Promise.all([
      supabase.from("orders").select("*, customers(name, vorname)").eq("id", orderId).single(),
      supabase.from("parts").select("id, teilname, laenge_mm, breite_mm").eq("order_id", orderId).order("created_at"),
      supabase.from("equipment").select("id, name, bauplatte_breite_mm, bauplatte_tiefe_mm").eq("ist_drucker", true),
      supabase.from("print_plates").select("*").eq("order_id", orderId).order("created_at", { ascending: true }),
    ]);
    setOrder(o.data);
    setParts((p.data as any) || []);
    setPrinters((eq.data as any) || []);
    setPlates((pl.data as any) || []);
    const plateList = (pl.data as any[]) || [];
    if (plateList.length) {
      const { data: pp } = await supabase
        .from("print_plate_parts").select("*").in("plate_id", plateList.map((x) => x.id));
      setPlacements((pp as any) || []);
      if (!activePlateId || !plateList.find((x) => x.id === activePlateId)) {
        setActivePlateId(plateList[0].id);
      }
    } else {
      setPlacements([]);
      setActivePlateId(null);
    }
    setLoading(false);
  };
  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [orderId]);

  // ====== HELPERS ======
  const activePlate = plates.find((p) => p.id === activePlateId) || null;
  const activePrinter = printers.find((p) => p.id === activePlate?.equipment_id) || null;
  const plateW = activePrinter?.bauplatte_breite_mm || 0;
  const plateH = activePrinter?.bauplatte_tiefe_mm || 0;
  const activePlacements = useMemo(
    () => placements.filter((pl) => pl.plate_id === activePlateId),
    [placements, activePlateId],
  );
  const partsById = useMemo(() => {
    const m = new Map<string, Part>();
    for (const p of parts) m.set(p.id, p);
    return m;
  }, [parts]);
  const placementsByPart = useMemo(() => {
    const m = new Map<string, Placement[]>();
    for (const pl of placements) {
      if (!m.has(pl.part_id)) m.set(pl.part_id, []);
      m.get(pl.part_id)!.push(pl);
    }
    return m;
  }, [placements]);
  const plateIndex = (pid: string) => plates.findIndex((p) => p.id === pid) + 1;

  // ====== DEBOUNCED SAVE ======
  const saveTimers = useRef<Map<string, number>>(new Map());
  const schedulePlacementSave = (pl: Placement) => {
    const t = saveTimers.current.get(pl.id);
    if (t) window.clearTimeout(t);
    const handle = window.setTimeout(async () => {
      await supabase.from("print_plate_parts").update({
        pos_x_mm: pl.pos_x_mm, pos_y_mm: pl.pos_y_mm, rot_deg: pl.rot_deg,
      }).eq("id", pl.id);
      saveTimers.current.delete(pl.id);
    }, 800);
    saveTimers.current.set(pl.id, handle);
  };

  const updatePlacement = (id: string, patch: Partial<Placement>) => {
    setPlacements((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, ...patch } : p));
      const updated = next.find((p) => p.id === id);
      if (updated) schedulePlacementSave(updated);
      return next;
    });
  };

  // ====== PLATE CRUD ======
  const handleCreatePlate = async () => {
    if (!newPlatePrinterId || !orderId) return;
    const nextIdx = plates.length + 1;
    const printer = printers.find((p) => p.id === newPlatePrinterId);
    const { data, error } = await supabase.from("print_plates").insert({
      order_id: orderId,
      equipment_id: newPlatePrinterId,
      name: `Platte ${nextIdx}${printer ? ` (${printer.name})` : ""}`,
      status: "geplant",
    }).select().single();
    if (error || !data) {
      toast({ title: "Fehler", description: error?.message, variant: "destructive" });
      return;
    }
    setPlates((p) => [...p, data as any]);
    setActivePlateId((data as any).id);
    setShowNewPlate(false);
    setNewPlatePrinterId("");
  };

  const handleDeletePlate = async (plateId: string) => {
    if (!confirm("Diese Platte und alle ihre Platzierungen löschen?")) return;
    await supabase.from("print_plates").delete().eq("id", plateId);
    setPlates((p) => p.filter((x) => x.id !== plateId));
    setPlacements((p) => p.filter((x) => x.plate_id !== plateId));
    if (activePlateId === plateId) {
      const rest = plates.filter((x) => x.id !== plateId);
      setActivePlateId(rest[0]?.id || null);
    }
  };

  // ====== ADD / MOVE PLACEMENT ======
  const addPartToPlate = async (partId: string, targetPlateId: string, fromPlacementId?: string) => {
    const target = plates.find((p) => p.id === targetPlateId);
    if (!target) return;
    const printer = printers.find((p) => p.id === target.equipment_id);
    const w = printer?.bauplatte_breite_mm || 0;
    const h = printer?.bauplatte_tiefe_mm || 0;
    if (fromPlacementId) {
      // move existing placement
      const { error } = await supabase.from("print_plate_parts").update({
        plate_id: targetPlateId,
        pos_x_mm: w / 2, pos_y_mm: h / 2, rot_deg: 0,
      }).eq("id", fromPlacementId);
      if (error) { toast({ title: "Fehler", description: error.message, variant: "destructive" }); return; }
      setPlacements((prev) => prev.map((p) =>
        p.id === fromPlacementId ? { ...p, plate_id: targetPlateId, pos_x_mm: w / 2, pos_y_mm: h / 2, rot_deg: 0 } : p,
      ));
    } else {
      const { data, error } = await supabase.from("print_plate_parts").insert({
        plate_id: targetPlateId, part_id: partId, menge: 1,
        pos_x_mm: w / 2, pos_y_mm: h / 2, rot_deg: 0,
      }).select().single();
      if (error || !data) { toast({ title: "Fehler", description: error?.message, variant: "destructive" }); return; }
      setPlacements((prev) => [...prev, data as any]);
    }
  };

  const removePlacement = async (placementId: string) => {
    await supabase.from("print_plate_parts").delete().eq("id", placementId);
    setPlacements((prev) => prev.filter((p) => p.id !== placementId));
    if (selectedPlacementId === placementId) setSelectedPlacementId(null);
  };

  // ====== HTML5 DRAG (list -> canvas / tabs) ======
  const onListDragStart = (e: React.DragEvent, partId: string, placementId?: string) => {
    e.dataTransfer.setData("text/plain", JSON.stringify({ partId, placementId }));
    e.dataTransfer.effectAllowed = "move";
  };
  const onCanvasDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverCanvas(false);
    if (!activePlateId) return;
    try {
      const data = JSON.parse(e.dataTransfer.getData("text/plain"));
      await addPartToPlate(data.partId, activePlateId, data.placementId);
    } catch {}
  };
  const onTabDrop = async (e: React.DragEvent, plateId: string) => {
    e.preventDefault();
    setTabDragOverId(null);
    try {
      const data = JSON.parse(e.dataTransfer.getData("text/plain"));
      await addPartToPlate(data.partId, plateId, data.placementId);
      setActivePlateId(plateId);
    } catch {}
  };

  // ====== 3D SCENE ======
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const sceneStateRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    transform: TransformControls;
    plateGroup: THREE.Group;
    partsGroup: THREE.Group;
    dropPlane: THREE.Mesh;
    raycaster: THREE.Raycaster;
    pointer: THREE.Vector2;
    meshByPlacementId: Map<string, THREE.Mesh>;
    stop: boolean;
  } | null>(null);

  // Mount once
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;
    const initW = Math.max(1, container.clientWidth);
    const initH = Math.max(1, container.clientHeight);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f7);

    const camera = new THREE.PerspectiveCamera(45, initW / initH, 0.1, 10000);
    camera.position.set(300, 400, 300);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(initW, initH);
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.0);
    key.position.set(200, 400, 200);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xff7a30, 0.25);
    fill.position.set(-150, 100, -150);
    scene.add(fill);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.target.set(0, 0, 0);
    // Linksklick = drag (eigene Logik), Rechtsklick = Kamera-Rotate, Mitte = Pan
    controls.mouseButtons = {
      LEFT: -1 as any,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.ROTATE,
    };

    const plateGroup = new THREE.Group();
    scene.add(plateGroup);
    const partsGroup = new THREE.Group();
    scene.add(partsGroup);

    // Invisible drop plane on Y=0
    const dropPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(20000, 20000),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    dropPlane.rotation.x = -Math.PI / 2;
    scene.add(dropPlane);

    // TransformControls (Gizmo)
    const transform = new TransformControls(camera, renderer.domElement);
    transform.setSize(0.8);
    transform.showY = false; // nur XZ verschieben
    scene.add(transform as unknown as THREE.Object3D);
    transform.addEventListener("dragging-changed", (e: any) => {
      controls.enabled = !e.value;
      // Bei Drag-Ende: aktuelle Mesh-Pose in DB übernehmen
      if (e.value === false) {
        const obj = transform.object as THREE.Mesh | undefined;
        if (!obj) return;
        const placementId = obj.userData.placementId as string;
        const pW = obj.userData.plateW as number;
        const pH = obj.userData.plateH as number;
        const px = obj.position.x + pW / 2;
        const py = obj.position.z + pH / 2;
        const deg = ((-obj.rotation.y * 180) / Math.PI);
        const norm = ((deg % 360) + 360) % 360;
        updatePlacement(placementId, { pos_x_mm: px, pos_y_mm: py, rot_deg: norm });
      }
    });

    const state = {
      renderer, scene, camera, controls, transform, plateGroup, partsGroup, dropPlane,
      raycaster: new THREE.Raycaster(),
      pointer: new THREE.Vector2(),
      meshByPlacementId: new Map<string, THREE.Mesh>(),
      stop: false,
    };
    sceneStateRef.current = state;

    const animate = () => {
      if (state.stop) return;
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const resize = () => {
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    window.addEventListener("resize", resize);
    // initial nach Layout
    requestAnimationFrame(resize);

    return () => {
      state.stop = true;
      window.removeEventListener("resize", resize);
      ro.disconnect();
      transform.detach();
      (transform as any).dispose?.();
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
    };
  }, []);

  // Rebuild plate visual when active plate / printer changes
  useEffect(() => {
    const s = sceneStateRef.current;
    if (!s) return;
    while (s.plateGroup.children.length) {
      const c = s.plateGroup.children.pop()!;
      (c as any).geometry?.dispose?.();
      (c as any).material?.dispose?.();
    }
    if (!plateW || !plateH) return;
    // Bauplatte
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(plateW, 4, plateH),
      new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.1, roughness: 0.85 }),
    );
    slab.position.y = -2;
    s.plateGroup.add(slab);
    // Grid 10mm
    const grid = new THREE.GridHelper(Math.max(plateW, plateH), Math.round(Math.max(plateW, plateH) / 10), 0xff5a00, 0xcccccc);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.5;
    grid.position.y = 0.05;
    // Clip grid visually by overlaying slab above; OK leave full grid
    s.plateGroup.add(grid);
    // Plate edge outline
    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(plateW, 0.1, plateH)),
      new THREE.LineBasicMaterial({ color: 0xff7a30 }),
    );
    edge.position.y = 0.1;
    s.plateGroup.add(edge);
    // Camera fit
    const diag = Math.max(plateW, plateH);
    s.camera.position.set(diag * 0.6, diag * 0.9, diag * 0.6);
    s.controls.target.set(0, 0, 0);
    s.controls.update();
  }, [plateW, plateH, activePlateId]);

  // Rebuild part meshes when activePlacements change
  useEffect(() => {
    const s = sceneStateRef.current;
    if (!s) return;
    // remove old
    while (s.partsGroup.children.length) {
      const c = s.partsGroup.children.pop() as THREE.Mesh;
      c.geometry?.dispose();
      (c.material as THREE.Material)?.dispose?.();
    }
    s.meshByPlacementId.clear();
    if (!plateW || !plateH) return;
    for (const pl of activePlacements) {
      const part = partsById.get(pl.part_id);
      if (!part || !part.laenge_mm || !part.breite_mm) continue;
      const w = Number(part.laenge_mm);
      const d = Number(part.breite_mm);
      const isSelected = pl.id === selectedPlacementId;
      const geom = new THREE.BoxGeometry(w, PART_HEIGHT_MM, d);
      const mat = new THREE.MeshStandardMaterial({
        color: isSelected ? 0xff7a30 : 0xff5a00,
        metalness: 0.15, roughness: 0.55,
        emissive: isSelected ? 0x331100 : 0x000000,
      });
      const mesh = new THREE.Mesh(geom, mat);
      // plate coord (center of part) -> scene: x = posX - plateW/2, z = posY - plateH/2
      mesh.position.set(
        Number(pl.pos_x_mm) - plateW / 2,
        PART_HEIGHT_MM / 2,
        Number(pl.pos_y_mm) - plateH / 2,
      );
      mesh.rotation.y = ((Number(pl.rot_deg) || 0) * Math.PI) / 180;
      mesh.userData.placementId = pl.id;
      mesh.userData.partName = part.teilname;
      mesh.userData.plateW = plateW;
      mesh.userData.plateH = plateH;
      // outline for selected
      if (isSelected) {
        const eg = new THREE.LineSegments(
          new THREE.EdgesGeometry(geom),
          new THREE.LineBasicMaterial({ color: 0xffffff }),
        );
        mesh.add(eg);
      }
      s.partsGroup.add(mesh);
      s.meshByPlacementId.set(pl.id, mesh);
    }
  }, [activePlacements, partsById, plateW, plateH, selectedPlacementId]);

  // ====== 3D INTERACTION (pick only — TransformControls handles drag) ======
  const computePointer = (e: React.PointerEvent | PointerEvent) => {
    const s = sceneStateRef.current;
    if (!s) return null;
    const rect = s.renderer.domElement.getBoundingClientRect();
    s.pointer.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    return rect;
  };

  const onCanvasPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return; // left only
    const s = sceneStateRef.current;
    if (!s) return;
    // wenn Gizmo gerade greift, nichts machen
    if ((s.transform as any).dragging) return;
    computePointer(e);
    s.raycaster.setFromCamera(s.pointer, s.camera);
    const hits = s.raycaster.intersectObjects(s.partsGroup.children, false);
    if (hits.length) {
      const mesh = hits[0].object as THREE.Mesh;
      const placementId = mesh.userData.placementId as string;
      setSelectedPlacementId(placementId);
    } else {
      setSelectedPlacementId(null);
    }
  };

  const onCanvasPointerMove = (e: React.PointerEvent) => {
    const s = sceneStateRef.current;
    if (!s) return;
    if ((s.transform as any).dragging) { setHoverTip(null); return; }
    computePointer(e);
    s.raycaster.setFromCamera(s.pointer, s.camera);
    const hits = s.raycaster.intersectObjects(s.partsGroup.children, false);
    if (hits.length) {
      const mesh = hits[0].object as THREE.Mesh;
      const rect = s.renderer.domElement.getBoundingClientRect();
      setHoverTip({
        x: e.clientX - rect.left, y: e.clientY - rect.top,
        text: mesh.userData.partName || "",
      });
    } else {
      setHoverTip(null);
    }
  };

  const onCanvasPointerUp = (_e: React.PointerEvent) => { /* noop */ };

  // Attach gizmo to selected mesh + Mode setzen
  useEffect(() => {
    const s = sceneStateRef.current;
    if (!s) return;
    s.transform.setMode(gizmoMode);
    s.transform.showY = false;
    if (gizmoMode === "translate") {
      s.transform.showX = true; s.transform.showZ = true;
    } else {
      // rotate: nur Y-Achse (oben/unten) — andere ausblenden
      s.transform.showX = false; s.transform.showZ = false;
      s.transform.showY = true;
    }
    if (selectedPlacementId) {
      const mesh = s.meshByPlacementId.get(selectedPlacementId);
      if (mesh) s.transform.attach(mesh);
      else s.transform.detach();
    } else {
      s.transform.detach();
    }
  }, [selectedPlacementId, gizmoMode, activePlacements, plateW, plateH]);

  // Center selected
  const centerSelected = () => {
    if (!selectedPlacementId) return;
    updatePlacement(selectedPlacementId, { pos_x_mm: plateW / 2, pos_y_mm: plateH / 2 });
  };

  // ====== ROTATION ======
  const selectedPlacement = placements.find((p) => p.id === selectedPlacementId) || null;
  const selectedPart = selectedPlacement ? partsById.get(selectedPlacement.part_id) : null;
  const setSelectedRotation = (deg: number) => {
    if (!selectedPlacement) return;
    const norm = ((deg % 360) + 360) % 360;
    updatePlacement(selectedPlacement.id, { rot_deg: norm });
  };

  // ====== ZIP ======
  const handleGenerateZip = async () => {
    if (!orderId) return;
    setZipping(true);
    const { data, error } = await supabase.functions.invoke("generate-plate-zip", { body: { orderId } });
    setZipping(false);
    if (error || data?.error) {
      toast({ title: "ZIP-Fehler", description: data?.error || error?.message, variant: "destructive" });
      return;
    }
    if (data?.url) window.open(data.url, "_blank");
    toast({ title: "ZIP erstellt ✓", description: `${data?.fileCount} Dateien · ${data?.plateCount} Platten` });
  };

  // ====== RENDER ======
  if (loading) {
    return <div className="p-8 text-sm text-muted-foreground">Laden…</div>;
  }

  return (
    <div className="h-[calc(100vh-3rem)] flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card px-4 py-3 flex items-center gap-3">
        <Link
          to={`/admin/auftraege/${orderId}`}
          className="text-muted-foreground hover:text-foreground p-1"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <Layers className="w-5 h-5 text-primary" />
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold truncate">Druckplatten-Planer</h1>
          <p className="text-xs text-muted-foreground truncate">
            {order?.name || order?.beschreibung || "Auftrag"}
            {order?.customers?.name && ` · ${order.customers.vorname || ""} ${order.customers.name}`.trim()}
          </p>
        </div>
        <Button size="sm" onClick={handleGenerateZip} disabled={zipping || plates.length === 0}>
          {zipping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          Gesamt-ZIP für Auftrag
        </Button>
      </div>

      <div className="flex-1 grid grid-cols-[280px_1fr] min-h-0">
        {/* LEFT: parts list */}
        <div className="border-r border-border bg-card/40 overflow-y-auto p-3 space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Teile ({parts.length})
          </h2>
          {parts.length === 0 && (
            <p className="text-xs text-muted-foreground">Keine Teile in diesem Auftrag.</p>
          )}
          {parts.map((part) => {
            const hasDims = !!(part.laenge_mm && part.breite_mm);
            const placed = placementsByPart.get(part.id) || [];
            return (
              <div
                key={part.id}
                className={`border border-border rounded-md p-2 text-xs space-y-1 ${
                  hasDims ? "bg-background hover:border-primary/60 cursor-grab active:cursor-grabbing" : "bg-muted/40 opacity-60"
                }`}
                draggable={hasDims}
                onDragStart={(e) => hasDims && onListDragStart(e, part.id)}
              >
                <div className="font-medium truncate">{part.teilname || "Teil"}</div>
                <div className="text-muted-foreground">
                  {hasDims ? (
                    <>{part.laenge_mm}×{part.breite_mm} mm</>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-500">
                      <AlertCircle className="w-3 h-3" /> Masse fehlen – STL hochladen
                    </span>
                  )}
                </div>
                {placed.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {placed.map((pl) => (
                      <span
                        key={pl.id}
                        draggable
                        onDragStart={(e) => { e.stopPropagation(); onListDragStart(e, part.id, pl.id); }}
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium cursor-grab ${
                          pl.plate_id === activePlateId
                            ? "bg-primary/20 text-primary border border-primary/40"
                            : "bg-muted text-muted-foreground border border-border"
                        }`}
                        title="Auf Tab ziehen, um auf andere Platte zu verschieben"
                      >
                        P{plateIndex(pl.plate_id)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* RIGHT: plate area */}
        <div className="flex flex-col min-h-0">
          {/* tabs */}
          <div className="border-b border-border bg-card/40 px-3 py-2 flex items-center gap-1.5 overflow-x-auto">
            {plates.map((p) => {
              const printer = printers.find((eq) => eq.id === p.equipment_id);
              const isActive = p.id === activePlateId;
              return (
                <button
                  key={p.id}
                  onClick={() => { setActivePlateId(p.id); setSelectedPlacementId(null); }}
                  onDragOver={(e) => { e.preventDefault(); setTabDragOverId(p.id); }}
                  onDragLeave={() => setTabDragOverId((cur) => cur === p.id ? null : cur)}
                  onDrop={(e) => onTabDrop(e, p.id)}
                  className={`px-3 py-1.5 rounded text-xs font-medium border whitespace-nowrap transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted border-border"
                  } ${tabDragOverId === p.id ? "ring-2 ring-primary" : ""}`}
                >
                  Platte {plateIndex(p.id)}{printer ? ` · ${printer.name}` : ""}
                </button>
              );
            })}
            <button
              onClick={() => {
                if (printers.length === 0) {
                  toast({ title: "Keine Drucker", description: "In der Maschinen-Verwaltung als 3D-Drucker markieren.", variant: "destructive" });
                  return;
                }
                setNewPlatePrinterId(printers[0].id);
                setShowNewPlate(true);
              }}
              className="px-3 py-1.5 rounded text-xs font-medium border border-dashed border-border hover:border-primary hover:text-primary inline-flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Neue Platte
            </button>
            {activePlate && (
              <button
                onClick={() => handleDeletePlate(activePlate.id)}
                className="ml-auto px-2 py-1.5 rounded text-xs text-destructive hover:bg-destructive/10 inline-flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> Platte löschen
              </button>
            )}
          </div>

          {/* 3D canvas + overlays */}
          <div className="relative flex-1 min-h-0" style={{ background: "#f5f5f7" }}>
            <div
              ref={canvasContainerRef}
              className="absolute inset-0"
              onPointerDown={onCanvasPointerDown}
              onPointerMove={onCanvasPointerMove}
              onPointerUp={onCanvasPointerUp}
              onPointerLeave={() => setHoverTip(null)}
              onDragOver={(e) => {
                if (!activePlateId) return;
                e.preventDefault();
                setDragOverCanvas(true);
              }}
              onDragLeave={() => setDragOverCanvas(false)}
              onDrop={onCanvasDrop}
            />
            {dragOverCanvas && (
              <div className="absolute inset-4 border-2 border-dashed border-primary rounded-lg pointer-events-none flex items-center justify-center bg-primary/5">
                <span className="text-primary text-sm font-medium">Hier ablegen, um auf Platte zu setzen</span>
              </div>
            )}
            {hoverTip && (
              <div
                className="absolute pointer-events-none px-2 py-1 rounded bg-card/95 border border-border text-xs shadow"
                style={{ left: hoverTip.x + 12, top: hoverTip.y + 12 }}
              >
                {hoverTip.text}
              </div>
            )}
            {!activePlate && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center space-y-2">
                  <Layers className="w-10 h-10 text-muted-foreground/40 mx-auto" />
                  <p className="text-sm text-muted-foreground">Noch keine Platte angelegt</p>
                </div>
              </div>
            )}
            {activePlate && (!plateW || !plateH) && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-xs text-amber-500 bg-card/90 border border-border rounded px-3 py-2">
                  Drucker hat keine Bauplatten-Masse hinterlegt.
                </div>
              </div>
            )}
            {/* hint */}
            {activePlate && plateW > 0 && (
              <div className="absolute top-2 left-2 text-[10px] text-muted-foreground bg-card/80 px-2 py-1 rounded">
                Klick = auswählen · Gizmo ziehen = bewegen/drehen · Rechtsklick = Kamera · Scroll = Zoom
              </div>
            )}
            {/* Gizmo-Toolbar */}
            {activePlate && plateW > 0 && (
              <div className="absolute left-3 top-1/2 -translate-y-1/2 flex flex-col gap-1 bg-card/90 border border-border rounded-lg p-1 shadow-lg">
                <button
                  title="Verschieben"
                  onClick={() => setGizmoMode("translate")}
                  className={`p-2 rounded transition-colors ${gizmoMode === "translate" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
                >
                  <Move className="w-4 h-4" />
                </button>
                <button
                  title="Drehen"
                  onClick={() => setGizmoMode("rotate")}
                  className={`p-2 rounded transition-colors ${gizmoMode === "rotate" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <button
                  title="Auf Plattenmitte zentrieren"
                  onClick={centerSelected}
                  disabled={!selectedPlacementId}
                  className="p-2 rounded transition-colors hover:bg-muted text-muted-foreground disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
            )}
            {/* selected part panel */}
            {selectedPlacement && selectedPart && (
              <div className="absolute top-3 right-3 w-64 bg-card border border-border rounded-lg p-3 space-y-3 shadow-xl">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Ausgewählt</p>
                    <p className="text-sm font-semibold truncate">{selectedPart.teilname}</p>
                    <p className="text-[10px] text-muted-foreground">{selectedPart.laenge_mm}×{selectedPart.breite_mm} mm</p>
                  </div>
                  <button onClick={() => setSelectedPlacementId(null)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5">
                    <RotateCw className="w-3 h-3" /> Rotation: {Math.round(selectedPlacement.rot_deg || 0)}°
                  </Label>
                  <input
                    type="range" min={0} max={359} step={1}
                    value={selectedPlacement.rot_deg || 0}
                    onChange={(e) => setSelectedRotation(parseFloat(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <div className="flex gap-1">
                    {[0, 45, 90, 135, 180, 225, 270, 315].map((d) => (
                      <button
                        key={d}
                        onClick={() => setSelectedRotation(d)}
                        className="flex-1 text-[10px] px-1 py-1 rounded border border-border hover:border-primary hover:text-primary"
                      >
                        {d}°
                      </button>
                    ))}
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Position: X={Math.round(selectedPlacement.pos_x_mm)} mm · Y={Math.round(selectedPlacement.pos_y_mm)} mm
                </div>
                <Button size="sm" variant="outline" className="w-full text-destructive hover:text-destructive" onClick={() => removePlacement(selectedPlacement.id)}>
                  <Trash2 className="w-3.5 h-3.5" /> Von Platte entfernen
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* NEW PLATE DIALOG */}
      <Dialog open={showNewPlate} onOpenChange={setShowNewPlate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neue Druckplatte</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Drucker</Label>
              <select
                value={newPlatePrinterId}
                onChange={(e) => setNewPlatePrinterId(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {printers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.bauplatte_breite_mm}×{p.bauplatte_tiefe_mm} mm)
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewPlate(false)}>Abbrechen</Button>
            <Button onClick={handleCreatePlate} disabled={!newPlatePrinterId}>
              <Plus className="w-3.5 h-3.5" /> Platte anlegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
