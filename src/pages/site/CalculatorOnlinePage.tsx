import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { takePendingUploads } from "@/lib/pendingUpload";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Upload, Trash2, Plus, Minus, Loader2, Send, ArrowRight, ArrowLeft, FileText,
  Check, Zap, Gauge, Shield, Gem, Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ModelPreview from "@/components/site/ModelPreview";
import { colorHex } from "@/lib/colorMap";
import JSZip from "jszip";
import Seo from "@/components/site/Seo";
import KiMaterialChat, { KiResult } from "@/components/site/KiMaterialChat";

interface Material {
  id: string;
  name: string;
  pricePerGram: number;
  density: number;
  farben: string[];
}

const QUALITY_PRESETS = [
  { key: "schnell", label: "Schnell", infill: 15, layerHeight: 0.3, layerFactor: 1.0, desc: "Leicht & günstig", Icon: Zap },
  { key: "standard", label: "Standard", infill: 20, layerHeight: 0.2, layerFactor: 1.15, desc: "Ausgewogen", Icon: Gauge },
  { key: "stark", label: "Stark", infill: 40, layerHeight: 0.15, layerFactor: 1.35, desc: "Belastbar", Icon: Shield },
  { key: "massiv", label: "Massiv", infill: 80, layerHeight: 0.1, layerFactor: 1.6, desc: "Maximale Festigkeit", Icon: Gem },
];

const presetByInfill = (infill: number) =>
  QUALITY_PRESETS.find((q) => q.infill === infill) || QUALITY_PRESETS[1];

const qualityAdminLabel = (infill: number) => {
  const q = presetByInfill(infill);
  return `${q.label} (${q.layerHeight}mm, ${q.infill}% Infill)`;
};

interface PartImage {
  id: string;
  file: File;
  storagePath?: string;
  uploading: boolean;
  previewUrl: string;
}

interface Part {
  id: string;
  fileName: string;
  file: File | null;
  storagePath?: string;
  uploading?: boolean;
  materialId: string;
  color: string;
  infill: number;
  quantity: number;
  volumeCm3: number; // 0 wenn unbekannt
  hasVolume: boolean;
  estimatedWeight: number;
  previewUrl?: string;
  images: PartImage[];
}

const CHF = (n: number) => `CHF ${n.toFixed(2)}`;
const SHIPPING_FREE_FROM = 65;
const SHIPPING_COST = 8;

const calcWeight = (volumeCm3: number, material: Material, infill: number): number => {
  // Shell ist immer solid — realistisch 35-40% des Volumens
  const shellFactor = 0.40
  const infillFactor = (1 - shellFactor) * (infill / 100)
  const fillFactor = shellFactor + infillFactor

  const baseWeight = volumeCm3 * material.density * fillFactor

  // Sicherheitszuschlag +25%
  const safetyFactor = 1.25

  return Math.max(1, Math.round(baseWeight * safetyFactor * 10) / 10)
}
const SETUP_FEE = 20;

async function calcStlVolumeCm3(file: File): Promise<number> {
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  let volume = 0;
  // ASCII STL beginnt mit "solid " (s = 115)
  const isBinary = view.byteLength < 84 ? false : view.getUint8(0) !== 115;
  if (isBinary) {
    const numTriangles = view.getUint32(80, true);
    let offset = 84;
    for (let i = 0; i < numTriangles; i++) {
      offset += 12; // normal
      const v1x = view.getFloat32(offset, true); const v1y = view.getFloat32(offset + 4, true); const v1z = view.getFloat32(offset + 8, true); offset += 12;
      const v2x = view.getFloat32(offset, true); const v2y = view.getFloat32(offset + 4, true); const v2z = view.getFloat32(offset + 8, true); offset += 12;
      const v3x = view.getFloat32(offset, true); const v3y = view.getFloat32(offset + 4, true); const v3z = view.getFloat32(offset + 8, true); offset += 12;
      offset += 2;
      volume += (v1x * (v2y * v3z - v2z * v3y) + v2x * (v3y * v1z - v3z * v1y) + v3x * (v1y * v2z - v1z * v2y)) / 6;
    }
  } else {
    // ASCII STL parser
    const text = new TextDecoder().decode(buffer);
    const verts: number[] = [];
    const re = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      verts.push(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]));
    }
    for (let i = 0; i < verts.length; i += 9) {
      const v1x = verts[i], v1y = verts[i + 1], v1z = verts[i + 2];
      const v2x = verts[i + 3], v2y = verts[i + 4], v2z = verts[i + 5];
      const v3x = verts[i + 6], v3y = verts[i + 7], v3z = verts[i + 8];
      volume += (v1x * (v2y * v3z - v2z * v3y) + v2x * (v3y * v1z - v3z * v1y) + v3x * (v1y * v2z - v1z * v2y)) / 6;
    }
  }
  return Math.abs(volume) / 1000; // mm³ → cm³
}

async function calcObjVolumeCm3(file: File): Promise<number> {
  const text = await file.text();
  const vertices: [number, number, number][] = [];
  let volume = 0;
  text.split("\n").forEach((line) => {
    const parts = line.trim().split(/\s+/);
    if (parts[0] === "v") {
      vertices.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
    } else if (parts[0] === "f") {
      const idx = parts.slice(1).map((p) => parseInt(p.split("/")[0]) - 1);
      for (let i = 1; i < idx.length - 1; i++) {
        const v1 = vertices[idx[0]], v2 = vertices[idx[i]], v3 = vertices[idx[i + 1]];
        if (v1 && v2 && v3) {
          volume += (v1[0] * (v2[1] * v3[2] - v2[2] * v3[1]) + v2[0] * (v3[1] * v1[2] - v3[2] * v1[1]) + v3[0] * (v1[1] * v2[2] - v1[2] * v2[1])) / 6;
        }
      }
    }
  });
  return Math.abs(volume) / 1000;
}

async function calc3mfVolumeCm3(file: File): Promise<number> {
  try {
    const buffer = await file.arrayBuffer()
    const zip = await JSZip.loadAsync(buffer)

    const modelEntry = Object.values(zip.files).find(f =>
      f.name.endsWith('.model') && !f.dir
    )
    if (!modelEntry) {
      console.warn('3MF: Kein .model File gefunden')
      return 0
    }

    const xml = await modelEntry.async('text')
    const parser = new DOMParser()
    const doc = parser.parseFromString(xml, 'text/xml')

    // getElementsByTagName ignoriert Namespaces
    const vertexNodes = doc.getElementsByTagName('vertex')
    const vertices: [number, number, number][] = []
    for (let i = 0; i < vertexNodes.length; i++) {
      const v = vertexNodes[i]
      vertices.push([
        parseFloat(v.getAttribute('x') || '0'),
        parseFloat(v.getAttribute('y') || '0'),
        parseFloat(v.getAttribute('z') || '0')
      ])
    }

    if (vertices.length === 0) return 0

    const triangleNodes = doc.getElementsByTagName('triangle')
    let volume = 0
    for (let i = 0; i < triangleNodes.length; i++) {
      const t = triangleNodes[i]
      const a = parseInt(t.getAttribute('v1') || '0')
      const b = parseInt(t.getAttribute('v2') || '0')
      const c = parseInt(t.getAttribute('v3') || '0')
      const v1 = vertices[a], v2 = vertices[b], v3 = vertices[c]
      if (v1 && v2 && v3) {
        volume += (
          v1[0] * (v2[1] * v3[2] - v2[2] * v3[1]) +
          v2[0] * (v3[1] * v1[2] - v3[2] * v1[1]) +
          v3[0] * (v1[1] * v2[2] - v1[2] * v2[1])
        ) / 6
      }
    }

    return Math.abs(volume) / 1000
  } catch (e) {
    console.error('3MF Volumen Fehler:', e)
    return 0
  }
}

function isStepFile(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase();
  return ext === "step" || ext === "stp";
}

const STEPS = ["Datei", "Bilder", "Material", "Farbe", "Qualität", "Übersicht"];

const CalculatorOnlinePage = () => {
  const [step, setStep] = useState(1);
  const [parts, setParts] = useState<Part[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(true);
  const [materialsError, setMaterialsError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [form, setForm] = useState({ vorname: "", nachname: "", email: "", phone: "", strasse: "", plz: "", ort: "", land: "Schweiz", message: "" });
  const [refImages, setRefImages] = useState<Array<{ id: string; file: File; storagePath?: string; uploading: boolean; previewUrl: string }>>([]);

  // Globale Auswahl (gilt für alle hochgeladenen Teile)
  const [materialId, setMaterialId] = useState("");
  const [color, setColor] = useState("");
  const [qualityKey, setQualityKey] = useState("standard");
  const [kiResult, setKiResult] = useState<KiResult | null>(null);
  const [chatKey, setChatKey] = useState(0);
  // Schnell-Schätzung (Einstieg von der Startseite): grober Preis vor dem geführten Prozess
  const [quickMode, setQuickMode] = useState(false);


  const addRefImage = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Nur Bilddateien erlaubt");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Bild zu gross (max. 20 MB)");
      return;
    }
    const id = crypto.randomUUID();
    const previewUrl = URL.createObjectURL(file);
    setRefImages(prev => [...prev, { id, file, uploading: true, previewUrl }]);
    try {
      const safe = file.name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "_");
      const path = `reference-images/${id}/${safe}`;
      const { error } = await supabase.storage.from("project-uploads").upload(path, file, {
        upsert: false,
        contentType: file.type || "image/jpeg",
      });
      if (error) throw error;
      setRefImages(prev => prev.map(r => r.id === id ? { ...r, storagePath: path, uploading: false } : r));
    } catch (e) {
      console.error("Bild-Upload fehlgeschlagen", e);
      toast.error("Bild-Upload fehlgeschlagen");
      setRefImages(prev => prev.filter(r => r.id !== id));
    }
  }, []);

  const removeRefImage = (id: string) => {
    setRefImages(prev => {
      const t = prev.find(r => r.id === id);
      if (t?.previewUrl) URL.revokeObjectURL(t.previewUrl);
      return prev.filter(r => r.id !== id);
    });
  };

  const loadMaterials = useCallback(async () => {
    const { data, error } = await supabase
      .from("materials")
      .select("*")
      .eq("aktiv", true)
      .order("sort_order");
    if (error) {
      setMaterialsError("Materialien konnten nicht geladen werden.");
    } else if (data) {
      setMaterials(
        data.map((m: any) => ({
          id: m.id,
          name: m.name,
          pricePerGram: Number(m.price_per_gram),
          density: Number(m.density),
          farben: Array.isArray(m.farben) ? m.farben : [],
        })),
      );
    }
    setMaterialsLoading(false);
  }, []);

  useEffect(() => {
    setMaterialsLoading(true);
    loadMaterials();
    const channel = supabase
      .channel("materials-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "materials" }, () => {
        loadMaterials();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadMaterials]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setIsLoggedIn(true);
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("user_id", user.id)
        .maybeSingle();
      const fullName = profile?.full_name || user.user_metadata?.full_name || "";
      const parts2 = fullName.trim().split(/\s+/);
      setForm((f) => ({
        ...f,
        vorname: parts2[0] || "",
        nachname: parts2.slice(1).join(" ") || "",
        email: user.email || "",
        phone: profile?.phone || user.user_metadata?.phone || "",
      }));
    })();
  }, []);

  const addFile = useCallback(async (file: File) => {
    const id = crypto.randomUUID();
    const defaultMat = materials[0];
    const defaultMatId = defaultMat?.id || "";
    const defaultMatName = defaultMat?.name || "";
    const defaultColor = defaultMat?.farben?.[0] || "";
    const ext = file.name.split(".").pop()?.toLowerCase();
    const previewable = ext === "stl" || ext === "obj" || ext === "3mf";
    const previewUrl = previewable ? URL.createObjectURL(file) : undefined;

    setParts((p) => [
      ...p,
      {
        id,
        fileName: file.name,
        file,
        uploading: true,
        materialId: defaultMatId,
        color: defaultColor,
        infill: 20,
        quantity: 1,
        volumeCm3: 0,
        hasVolume: false,
        estimatedWeight: 0,
        previewUrl,
        images: [],
      },
    ]);

    // Volumen berechnen
    try {
      let vol = 0;
      if (ext === "stl") vol = await calcStlVolumeCm3(file);
      else if (ext === "obj") vol = await calcObjVolumeCm3(file);
      else if (ext === "3mf") vol = await calc3mfVolumeCm3(file);

      if (vol > 0) {
        const mat = materials[0];
        const weightG = mat ? calcWeight(vol, mat, 20) : 0;
        setParts((p) =>
          p.map((x) =>
            x.id === id ? { ...x, volumeCm3: vol, hasVolume: true, estimatedWeight: weightG } : x,
          ),
        );
      }
    } catch (err) {
      console.warn("Volumen-Berechnung fehlgeschlagen", err);
    }

    // Upload im Hintergrund
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `kalkulator/${id}-${safeName}`;
      const { error } = await supabase.storage.from("project-uploads").upload(path, file, { upsert: false });
      if (error) throw error;
      setParts((p) => p.map((x) => (x.id === id ? { ...x, storagePath: path, uploading: false } : x)));

      try {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from("calculator_uploads").insert({
          id,
          file_name: file.name,
          storage_path: path,
          size_bytes: file.size,
          bucket: "project-uploads",
          material_id: defaultMatId || null,
          material_name: defaultMatName || null,
          color: "Weiss",
          infill: 20,
          quantity: 1,
          estimated_weight: 0,
          auth_user_id: user?.id ?? null,
          customer_email: user?.email ?? null,
          session_id: id,
          status: "neu",
        } as any);
      } catch (logErr) {
        console.warn("Upload-Eintrag konnte nicht angelegt werden", logErr);
      }
    } catch (err) {
      console.error("Upload-Fehler", err);
      setParts((p) => p.map((x) => (x.id === id ? { ...x, uploading: false } : x)));
      toast.error(`Upload von ${file.name} fehlgeschlagen — wir bitten dich, die Datei per Mail zu schicken.`);
    }
  }, [materials]);

  // Dateien, die auf einer anderen Seite (Hero-Dropzone, Mobile-CTA) gewählt wurden
  const pendingHandled = useRef(false);
  useEffect(() => {
    if (pendingHandled.current || materials.length === 0) return;
    const files = takePendingUploads();
    if (files.length === 0) return;
    pendingHandled.current = true;
    setQuickMode(true);
    files.forEach(addFile);

  }, [materials, addFile]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    Array.from(e.dataTransfer.files).forEach(addFile);
  };
  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files || []).forEach(addFile);
    e.target.value = "";
  };

  const update = (id: string, u: Partial<Part>) => {
    const currentPart = parts.find((x) => x.id === id);
    if (currentPart && currentPart.volumeCm3 > 0 && (u.infill !== undefined || u.materialId !== undefined)) {
      const newInfill = u.infill ?? currentPart.infill;
      const newMatId = u.materialId ?? currentPart.materialId;
      const mat = materials.find((m) => m.id === newMatId);
      if (mat) {
        u = { ...u, estimatedWeight: calcWeight(currentPart.volumeCm3, mat, newInfill) };
      }
    }
    setParts((p) => p.map((x) => {
      if (x.id !== id) return x;
      const next = { ...x, ...u };
      if (u.materialId !== undefined && u.materialId !== x.materialId) {
        const newMat = materials.find((m) => m.id === u.materialId);
        const avail = newMat?.farben || [];
        if (avail.length > 0 && !avail.includes(next.color)) {
          next.color = avail[0];
        }
      }
      return next;
    }));
    const matName = u.materialId ? materials.find((m) => m.id === u.materialId)?.name : undefined;
    const patch: any = {};
    if (u.materialId !== undefined) { patch.material_id = u.materialId || null; patch.material_name = matName || null; }
    if (u.color !== undefined) patch.color = u.color;
    if (u.infill !== undefined) patch.infill = u.infill;
    if (u.quantity !== undefined) patch.quantity = u.quantity;
    if (Object.keys(patch).length > 0) {
      supabase.from("calculator_uploads").update(patch).eq("id", id).then(() => {});
    }
  };

  const applyAll = (u: Partial<Part>) => parts.forEach((p) => update(p.id, u));

  const remove = (id: string) => setParts((p) => {
    const target = p.find((x) => x.id === id);
    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
    target?.images.forEach(img => { if (img.previewUrl) URL.revokeObjectURL(img.previewUrl); });
    return p.filter((x) => x.id !== id);
  });

  const addPartImage = useCallback(async (partId: string, file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Nur Bilddateien erlaubt");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Bild zu gross (max. 20 MB)");
      return;
    }
    const imgId = crypto.randomUUID();
    const previewUrl = URL.createObjectURL(file);
    setParts(prev => prev.map(p => p.id === partId
      ? { ...p, images: [...p.images, { id: imgId, file, uploading: true, previewUrl }] }
      : p));
    try {
      const safe = file.name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "_");
      const path = `reference-images/${partId}/${imgId}_${safe}`;
      const { error } = await supabase.storage.from("project-uploads").upload(path, file, {
        upsert: false,
        contentType: file.type || "image/jpeg",
      });
      if (error) throw error;
      setParts(prev => prev.map(p => p.id === partId
        ? { ...p, images: p.images.map(i => i.id === imgId ? { ...i, storagePath: path, uploading: false } : i) }
        : p));
    } catch (e) {
      console.error("Bild-Upload fehlgeschlagen", e);
      toast.error("Bild-Upload fehlgeschlagen");
      setParts(prev => prev.map(p => p.id === partId
        ? { ...p, images: p.images.filter(i => i.id !== imgId) }
        : p));
    }
  }, []);

  const removePartImage = (partId: string, imgId: string) => {
    setParts(prev => prev.map(p => {
      if (p.id !== partId) return p;
      const img = p.images.find(i => i.id === imgId);
      if (img?.previewUrl) URL.revokeObjectURL(img.previewUrl);
      return { ...p, images: p.images.filter(i => i.id !== imgId) };
    }));
  };

  const calcPart = (p: Part) => {
    const mat = materials.find((m) => m.id === p.materialId);
    if (!mat || !p.hasVolume || p.estimatedWeight <= 0) {
      return { weight: 0, unit: 0, subtotal: 0, discount: 0 };
    }
    const weight = p.estimatedWeight;
    const layerFactor = presetByInfill(p.infill).layerFactor;
    const matCost = weight * mat.pricePerGram * layerFactor;
    const unit = matCost;
    let discount = 0;
    if (p.quantity >= 10) discount = 0.15;
    else if (p.quantity >= 5) discount = 0.1;
    return { weight, unit, subtotal: unit * p.quantity * (1 - discount), discount };
  };

  const calcs = parts.map((p) => ({ part: p, calc: calcPart(p) }));
  const materialTotal = calcs.reduce((s, { calc }) => s + calc.subtotal, 0);
  const setupFee = parts.length > 0 ? SETUP_FEE : 0;
  const subtotal = materialTotal + setupFee;
  const shipping = subtotal === 0 ? 0 : subtotal >= SHIPPING_FREE_FROM ? 0 : SHIPPING_COST;
  const total = subtotal + shipping;

  const hasStep = parts.some((p) => isStepFile(p.fileName));
  const selectedMaterial = materials.find((m) => m.id === materialId) || null;
  const availableColors = selectedMaterial?.farben || [];

  // Schritt 1 wechselt NICHT automatisch — der Nutzer kann beliebig viele Teile
  // hinzufügen und klickt selbst auf "Weiter".

  // Schnell-Schätzung: sobald analysiert, globales Material auf Standard setzen
  const quickReady = quickMode && parts.length > 0 && parts.every((p) => p.hasVolume || isStepFile(p.fileName));
  useEffect(() => {
    if (!quickMode || materialId || parts.length === 0) return;
    const fallback = parts[0].materialId || materials[0]?.id || "";
    if (fallback) {
      setMaterialId(fallback);
      const mat = materials.find((m) => m.id === fallback);
      setColor(mat?.farben?.[0] || "");
    }
  }, [quickMode, materialId, parts, materials]);


  const geometryText = useMemo(() => {
    if (parts.length === 0) return "";
    if (parts.length === 1) {
      const p = parts[0];
      return p.hasVolume ? `Volumen ca. ${p.volumeCm3.toFixed(1)} cm³` : "Geometrie unbekannt";
    }
    return parts
      .map((p) => `${p.fileName}: ${p.hasVolume ? `ca. ${p.volumeCm3.toFixed(1)} cm³` : "Geometrie unbekannt"}`)
      .join(" | ");
  }, [parts]);

  const chooseMaterial = (id: string) => {
    setMaterialId(id);
    const mat = materials.find((m) => m.id === id);
    const firstColor = mat?.farben?.[0] || "";
    setColor((c) => (mat?.farben?.includes(c) ? c : firstColor));
    applyAll({ materialId: id });
  };

  const handleKiResult = (r: KiResult) => {
    setKiResult(r);
    const match = materials.find((m) => m.name.toLowerCase().includes(r.material.toLowerCase()))
      || materials.find((m) => r.material.toLowerCase().includes(m.name.toLowerCase()));
    if (match) setKiResult({ ...r, material: match.name });
  };

  const recommendedMaterial = useMemo(() => {
    if (!kiResult) return null;
    return materials.find((m) => m.name.toLowerCase() === kiResult.material.toLowerCase())
      || materials.find((m) => m.name.toLowerCase().includes(kiResult.material.toLowerCase()))
      || null;
  }, [kiResult, materials]);

  const kiSummary = useMemo(() => {
    if (!kiResult) return null;
    const lines = [
      `Bauteile (${parts.length}):`,
      ...parts.map((p) => `- ${p.fileName}${p.hasVolume ? ` (${p.volumeCm3.toFixed(1)} cm³, ca. ${p.estimatedWeight.toFixed(1)} g)` : ""}`),
      `Empfohlenes Material: ${kiResult.material} — ${kiResult.begruendung}`,
      "",
      "--- Gesprächsverlauf ---",
      kiResult.transcript,
    ];
    return lines.join("\n");
  }, [kiResult, parts]);

  const canNext =
    (step === 1 && parts.length > 0) ||
    step === 2 ||
    (step === 3 && !!materialId) ||
    (step === 4 && (!!color || availableColors.length === 0)) ||
    step === 5;

  const goNext = () => setStep((s) => Math.min(STEPS.length, s + 1));
  const goBack = () => setStep((s) => Math.max(1, s - 1));

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const summary = parts
        .map((p) => `${p.fileName} (${p.quantity}× ${(materials.find(m => m.id === p.materialId)?.name || p.materialId)}, ${p.color}, ${qualityAdminLabel(p.infill)})`)
        .join("; ");
      const { data: { user } } = await supabase.auth.getUser();
      let customer_id: string | null = null;
      let resolvedVorname = form.vorname.trim();
      let resolvedNachname = form.nachname.trim();
      let resolvedEmail = form.email.trim();
      let resolvedPhone = form.phone.trim();
      if (user) {
        const { data: cust } = await supabase.from("customers").select("id, name, vorname, telefon").eq("auth_user_id", user.id).maybeSingle();
        customer_id = cust?.id ?? null;
        if (!resolvedEmail) resolvedEmail = user.email || "";
        if (!resolvedVorname && !resolvedNachname) {
          resolvedVorname = cust?.vorname || "";
          resolvedNachname = cust?.name || "";
          if (!resolvedVorname && !resolvedNachname) {
            const full = (user.user_metadata?.full_name as string) || "";
            const ps = full.trim().split(/\s+/);
            resolvedVorname = ps[0] || user.email || "Kunde";
            resolvedNachname = ps.slice(1).join(" ") || "";
          }
        }
        if (!resolvedPhone) resolvedPhone = (cust?.telefon as string) || "";
      } else {
        if (resolvedEmail) {
          const { data: existing } = await supabase.from("customers")
            .select("id, vorname, name, strasse, plz, ort")
            .ilike("email", resolvedEmail).maybeSingle();
          if (existing) {
            customer_id = existing.id;
            const updates: any = {};
            if (!existing.strasse && form.strasse) updates.strasse = form.strasse;
            if (!existing.plz && form.plz) updates.plz = form.plz;
            if (!existing.ort && form.ort) updates.ort = form.ort;
            if (!existing.vorname && resolvedVorname) updates.vorname = resolvedVorname;
            if (!existing.name && resolvedNachname) updates.name = resolvedNachname;
            if (Object.keys(updates).length > 0) {
              await supabase.from("customers").update(updates).eq("id", existing.id);
            }
          } else {
            const { data: created } = await supabase.from("customers").insert({
              vorname: resolvedVorname,
              name: resolvedNachname || resolvedVorname,
              email: resolvedEmail,
              telefon: resolvedPhone || null,
              strasse: form.strasse || null,
              plz: form.plz || null,
              ort: form.ort || null,
              land: form.land || "Schweiz",
              notizen: "Über Online-Kalkulator angelegt",
            } as any).select("id").maybeSingle();
            customer_id = created?.id ?? null;
          }
        }
      }
      const resolvedName = `${resolvedVorname} ${resolvedNachname}`.trim() || resolvedEmail || "Kunde";
      const addressLine = !user && (form.strasse || form.plz || form.ort)
        ? `\n\nAdresse: ${form.strasse}, ${form.plz} ${form.ort}, ${form.land}`
        : "";
      const kiBlock = kiSummary ? `\n\n--- KI-Materialberatung ---\n${kiSummary}` : "";
      const partImageAttachments = parts.flatMap(p =>
        p.images.filter(i => i.storagePath).map(i => ({
          filename: i.file.name,
          storage_path: i.storagePath,
          size_bytes: i.file.size,
          bucket: "project-uploads",
          kind: "part-reference-image",
          part_label: p.fileName,
        }))
      );
      const attachments = [
        ...parts
          .filter((p) => p.storagePath)
          .map((p) => ({
            filename: p.fileName,
            storage_path: p.storagePath,
            size_bytes: p.file?.size ?? null,
            bucket: "project-uploads",
          })),
        ...partImageAttachments,
        ...refImages
          .filter(r => r.storagePath)
          .map(r => ({
            filename: r.file.name,
            storage_path: r.storagePath,
            size_bytes: r.file.size,
            bucket: "project-uploads",
            kind: "reference-image",
          })),
      ];

      const nachricht = `${summary}\n\nGeschätzter Gesamtpreis: ${CHF(total)}${addressLine}${kiBlock}\n\nNachricht: ${form.message}`;

      const { error } = await supabase.from("inquiries").insert({
        name: resolvedName,
        email: resolvedEmail,
        telefon: resolvedPhone || null,
        betreff: "Preisanfrage Kalkulator",
        nachricht,
        status: "Neu",
        quelle: "kalkulator",
        customer_id,
        attachments,
        ki_beratung_zusammenfassung: kiSummary,
        ki_empfohlenes_material: kiResult?.material ?? null,
      } as any);
      if (error) throw error;

      supabase.functions.invoke("notify-inquiry-admin", {
        body: {
          name: resolvedName,
          email: resolvedEmail,
          telefon: resolvedPhone || null,
          betreff: "Preisanfrage Kalkulator",
          nachricht,
          ki_beratung_zusammenfassung: kiSummary,
        },
      }).catch((e) => console.error("Admin-Mail Fehler:", e));

      toast.success("Anfrage gesendet! Wir melden uns innerhalb 24h.");
      setForm({ vorname: "", nachname: "", email: "", phone: "", strasse: "", plz: "", ort: "", land: "Schweiz", message: "" });
      setParts([]);
      refImages.forEach(r => { if (r.previewUrl) URL.revokeObjectURL(r.previewUrl); });
      setRefImages([]);
      setKiResult(null);
      setMaterialId("");
      setColor("");
      setQualityKey("standard");
      setChatKey((k) => k + 1);
      setStep(1);
    } catch (err) {
      console.error(err);
      toast.error("Fehler beim Senden — bitte später erneut versuchen.");
    } finally {
      setSubmitting(false);
    }
  };

  const priceBadge = !materialId || parts.length === 0 || hasStep ? null : total;

  return (
    <div className="pb-20">
      <Seo
        title="3D Druck Kosten berechnen – Sofortpreis online | 3DMuscio"
        description="Berechnen Sie Ihren 3D Druckauftrag sofort und kostenlos. Preis in Sekunden, kein Anmelden nötig. FDM & SLA Druck ab CHF 5.– | 3DMuscio Schweiz"
        path="/kalkulator-online"
      />

      {/* Sticky Stepper-Header */}
      <div className="sticky top-16 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="container mx-auto px-4 max-w-4xl py-3">
          <div className="flex items-center gap-1.5 sm:gap-2">
            {STEPS.map((label, i) => {
              const n = i + 1;
              const active = n === step;
              const doneStep = n < step;
              return (
                <div key={label} className="flex items-center gap-1.5 sm:gap-2 flex-1 last:flex-none">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div
                      className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                        active
                          ? "bg-primary text-primary-foreground"
                          : doneStep
                            ? "bg-primary/15 text-primary"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {doneStep ? <Check className="w-3.5 h-3.5" /> : n}
                    </div>
                    <span className={`hidden sm:block text-xs truncate ${active ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                      {label}
                    </span>
                  </div>
                  {n < STEPS.length && (
                    <div className={`h-px flex-1 ${doneStep ? "bg-primary/40" : "bg-border"}`} />
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={goBack}
              disabled={step === 1}
              className="gap-1.5 text-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Zurück
            </Button>
            <div
              className={`px-3 py-1.5 rounded-full text-sm font-bold tabular-nums transition-colors ${
                priceBadge !== null ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              }`}
            >
              {hasStep ? "Preis nach Prüfung" : priceBadge !== null ? `Aktueller Preis: ${CHF(priceBadge)}` : "Aktueller Preis: CHF –.–"}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-4xl pt-8">
        {materialsLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : materialsError ? (
          <div className="text-center py-20 text-destructive">{materialsError}</div>
        ) : quickMode ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="max-w-2xl mx-auto"
          >
            <div className="bg-card border border-border rounded-3xl p-6 md:p-10 text-center">
              {!quickReady ? (
                <div className="py-10">
                  <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
                  <p className="font-heading text-lg font-bold text-foreground">Modell wird analysiert…</p>
                  <p className="text-sm text-muted-foreground mt-1">Wir berechnen Volumen und Gewicht deiner Datei.</p>
                </div>
              ) : (
                <>
                  <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">Schnellschätzung</p>
                  <h1 className="font-heading text-2xl md:text-3xl font-extrabold text-foreground mb-2">
                    {hasStep ? "Preis nach Prüfung" : "Grober Preis"}
                  </h1>
                  {hasStep ? (
                    <p className="text-muted-foreground text-sm">
                      STEP-Dateien können nicht automatisch berechnet werden. Starte die genaue Analyse für ein Angebot.
                    </p>
                  ) : (
                    <>
                      <div className="font-heading text-4xl md:text-5xl font-extrabold text-primary tabular-nums my-4">
                        ca. {CHF(total)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Unverbindliche Schätzung mit Standard-Material und Standard-Qualität, inkl. Setup und Versand.
                      </p>
                    </>
                  )}

                  <div className="mt-6 space-y-2 text-left">
                    {parts.map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-3 bg-muted/40 rounded-xl px-4 py-3">
                        <span className="text-sm truncate">{p.fileName}</span>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs text-muted-foreground">
                            {p.hasVolume ? `${p.volumeCm3.toFixed(1)} cm³ · ca. ${p.estimatedWeight.toFixed(1)} g` : "Prüfung nötig"}
                          </span>
                          <button onClick={() => remove(p.id)} aria-label="Datei entfernen" className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4">
                    <input id="quick-file-input" type="file" multiple accept=".stl,.3mf,.step,.obj" className="hidden" onChange={handleInput} />
                    <label htmlFor="quick-file-input">
                      <Button asChild variant="outline" size="sm" className="gap-2 cursor-pointer">
                        <span><Plus className="w-4 h-4" /> Weitere Teile hinzufügen</span>
                      </Button>
                    </label>
                  </div>


                  <div className="mt-8">
                    <p className="font-heading font-bold text-foreground mb-1">Möchtest du eine genauere Analyse?</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Material-Beratung mit KI, Farbe, Qualität und ein verbindliches Angebot.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <Button
                        className="gap-2"
                        onClick={() => { setQuickMode(false); setStep(2); }}
                      >
                        Ja, genaue Analyse starten <ArrowRight className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => { setQuickMode(false); setStep(1); }}
                      >
                        Nein danke, selbst konfigurieren
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        ) : (

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            >
              {/* ---------- SCHRITT 1 ---------- */}
              {step === 1 && (
                <div className="space-y-6">
                  <div className="text-center">
                    <h1 className="font-heading text-2xl md:text-4xl font-extrabold text-foreground mb-2">
                      Datei hochladen
                    </h1>
                    <p className="text-muted-foreground">
                      STL, 3MF, STEP oder OBJ — mehrere Teile auf einmal möglich. Wir analysieren alles sofort.
                    </p>
                  </div>

                  <div
                    onDrop={handleDrop}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all ${
                      dragOver ? "border-primary bg-primary/5" : "border-border bg-card"
                    }`}
                  >
                    <input id="file-input" type="file" multiple accept=".stl,.3mf,.step,.obj" className="hidden" onChange={handleInput} />
                    <Upload className="w-12 h-12 text-primary mx-auto mb-4" />
                    <h2 className="font-heading text-xl font-bold text-foreground mb-2">Dateien hierher ziehen</h2>
                    <p className="text-sm text-muted-foreground mb-4">STL, 3MF, STEP, OBJ — bis 500MB pro Datei</p>
                    <label htmlFor="file-input">
                      <Button asChild className="gap-2 cursor-pointer">
                        <span><Upload className="w-4 h-4" /> Dateien auswählen</span>
                      </Button>
                    </label>
                  </div>

                  {parts.length > 0 && (
                    <div className="space-y-3">
                      {parts.map((p) => (
                        <div key={p.id} className="bg-card rounded-2xl border border-border p-4 flex items-center gap-4">
                          {p.file ? (
                            <div className="w-16 h-16 rounded-xl bg-muted overflow-hidden shrink-0">
                              <ModelPreview file={p.file} />
                            </div>
                          ) : (
                            <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center shrink-0">
                              <FileText className="w-7 h-7 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">{p.fileName}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {p.hasVolume && p.volumeCm3 > 0
                                ? `Volumen: ${p.volumeCm3.toFixed(1)} cm³`
                                : isStepFile(p.fileName)
                                  ? "STEP-Datei · Preis nach manueller Prüfung"
                                  : "Volumen wird berechnet…"}
                              {p.uploading && <span className="ml-2 text-primary">· wird hochgeladen…</span>}
                            </p>
                          </div>
                          <button onClick={() => remove(p.id)} aria-label="Datei entfernen" className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {parts.length > 0 && (
                    <div>
                      <input id="step1-add-file" type="file" multiple accept=".stl,.3mf,.step,.obj" className="hidden" onChange={handleInput} />
                      <label htmlFor="step1-add-file">
                        <Button asChild variant="outline" className="w-full gap-2 cursor-pointer">
                          <span><Plus className="w-4 h-4" /> Weiteres Teil hinzufügen</span>
                        </Button>
                      </label>
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        Du kannst mehrere Teile gleichzeitig kalkulieren — die KI-Beratung berücksichtigt alle Teile.
                      </p>
                    </div>
                  )}

                  {hasStep && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm">
                      <p className="font-medium text-amber-800">⚠️ STEP-Dateien können nicht automatisch berechnet werden.</p>
                      <p className="text-amber-700 text-xs mt-1">Der Preis folgt nach manueller Prüfung — du kannst trotzdem eine unverbindliche Anfrage senden.</p>
                      <a href="https://convert3d.org/step-to-stl" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary font-medium mt-2 hover:underline">
                        Kostenlos zu STL konvertieren →
                      </a>
                    </div>
                  )}

                  {parts.length > 0 && (
                    <Button className="w-full gap-2" onClick={goNext}>
                      Weiter zu den Bildern <ArrowRight className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              )}

              {/* ---------- SCHRITT 2 ---------- */}
              {step === 2 && (
                <div className="space-y-6">
                  <div>
                    <h1 className="font-heading text-2xl md:text-3xl font-extrabold text-foreground mb-1">Bilder hochladen</h1>
                    <p className="text-muted-foreground text-sm">
                      Lade ein Bild des gesamten Modells (zusammengebaut) und/oder der einzelnen Teile hoch — Foto, Screenshot oder Skizze.
                      So verstehen wir genau, wie das Ergebnis aussehen soll.
                    </p>
                  </div>

                  <div className="bg-card rounded-2xl border border-border p-5">
                    <h3 className="font-heading text-base font-bold text-foreground">📷 Gesamtmodell &amp; Einzelteile</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 mb-3">
                      Mehrere Bilder möglich · JPG/PNG · max. 20 MB pro Bild · optional, aber sehr hilfreich.
                    </p>
                    <input
                      id="ref-image-input" type="file" multiple accept="image/*" className="hidden"
                      onChange={(e) => { Array.from(e.target.files || []).forEach(addRefImage); e.target.value = ""; }}
                    />
                    <label htmlFor="ref-image-input">
                      <Button asChild variant="outline" size="sm" className="gap-2 cursor-pointer">
                        <span><Upload className="w-3.5 h-3.5" /> Bilder hinzufügen</span>
                      </Button>
                    </label>
                    {refImages.length > 0 && (
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mt-4">
                        {refImages.map(r => (
                          <div key={r.id} className="relative aspect-square rounded-lg overflow-hidden border border-border bg-muted group">
                            <img src={r.previewUrl} alt={r.file.name} className="w-full h-full object-cover" loading="lazy" />
                            {r.uploading && (
                              <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                              </div>
                            )}
                            <button type="button" onClick={() => removeRefImage(r.id)} aria-label="Bild entfernen"
                              className="absolute top-1 right-1 bg-background/80 hover:bg-destructive hover:text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button className="w-full gap-2" onClick={goNext}>
                    {refImages.length > 0 ? "Weiter zur Materialwahl" : "Ohne Bilder weiter"} <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              )}


              {/* ---------- SCHRITT 3 ---------- */}
              {step === 3 && (
                <div className="space-y-6">
                  <div>
                    <h1 className="font-heading text-2xl md:text-3xl font-extrabold text-foreground mb-1">Material wählen</h1>
                    <p className="text-muted-foreground text-sm">Diskutiere mit unserer KI: stelle Fragen, vergleiche Materialien und übernimm am Ende die Empfehlung — oder wähle selbst.</p>
                  </div>

                  <KiMaterialChat
                    key={chatKey}
                    fileName={parts.map((p) => p.fileName).join(", ")}
                    geometry={geometryText}
                    availableMaterials={materials.map((m) => m.name)}
                    partNames={parts.map((p) => p.fileName)}
                    onResult={handleKiResult}
                  />

                  {kiResult && (
                    <div className="rounded-2xl border-2 border-primary bg-primary/5 p-5">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold text-primary mb-1">
                        <Sparkles className="w-3.5 h-3.5" /> Empfehlung
                      </div>
                      <p className="font-heading text-2xl font-extrabold text-primary">{kiResult.material}</p>
                      <p className="text-sm text-muted-foreground mt-2">{kiResult.begruendung}</p>
                      {recommendedMaterial && (
                        <Button
                          className="mt-4 gap-2"
                          onClick={() => chooseMaterial(recommendedMaterial.id)}
                          disabled={materialId === recommendedMaterial.id}
                        >
                          <Check className="w-4 h-4" />
                          {materialId === recommendedMaterial.id ? `${recommendedMaterial.name} übernommen` : `${recommendedMaterial.name} übernehmen`}
                        </Button>
                      )}
                    </div>
                  )}

                  <div>
                    <p className="text-sm font-semibold mb-2">Alle Materialien</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {materials.map((m) => {
                        const sel = materialId === m.id;
                        const rec = recommendedMaterial?.id === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => chooseMaterial(m.id)}
                            className={`relative text-left rounded-xl border-2 p-4 transition-all ${
                              sel ? "border-primary bg-primary/5" : rec ? "border-primary/40 bg-card" : "border-border bg-card hover:border-primary/40"
                            }`}
                          >
                            {rec && !sel && (
                              <span className="absolute top-2 right-2 text-[10px] font-bold text-primary uppercase">Empfohlen</span>
                            )}
                            {sel && <Check className="absolute top-2 right-2 w-4 h-4 text-primary" />}
                            <p className="font-bold text-sm">{m.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{m.farben.length} Farben</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {materialId && (
                    <Button className="w-full gap-2" onClick={goNext}>
                      Weiter zur Farbe <ArrowRight className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              )}

              {/* ---------- SCHRITT 4 ---------- */}
              {step === 4 && (
                <div className="space-y-6">
                  <div>
                    <h1 className="font-heading text-2xl md:text-3xl font-extrabold text-foreground mb-1">Farbe wählen</h1>
                    <p className="text-muted-foreground text-sm">Verfügbare Farben für {selectedMaterial?.name}.</p>
                  </div>

                  {availableColors.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Für dieses Material stimmen wir die Farbe individuell mit dir ab.</p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                      {availableColors.map((name) => {
                        const sel = color === name;
                        return (
                          <button
                            key={name}
                            type="button"
                            onClick={() => { setColor(name); applyAll({ color: name }); }}
                            className={`rounded-xl border-2 p-3 flex flex-col items-center gap-2 transition-all ${
                              sel ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
                            }`}
                          >
                            <span
                              className="w-10 h-10 rounded-full border border-border"
                              style={{ backgroundColor: colorHex(name) }}
                            />
                            <span className="text-xs font-medium text-center">{name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <Button className="w-full gap-2" onClick={goNext} disabled={availableColors.length > 0 && !color}>
                    Weiter zur Qualität <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              )}

              {/* ---------- SCHRITT 5 ---------- */}
              {step === 5 && (
                <div className="space-y-6">
                  <div>
                    <h1 className="font-heading text-2xl md:text-3xl font-extrabold text-foreground mb-1">Qualität wählen</h1>
                    <p className="text-muted-foreground text-sm">Wie belastbar soll dein Teil sein?</p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {QUALITY_PRESETS.map((q) => {
                      const sel = qualityKey === q.key;
                      const Icon = q.Icon;
                      return (
                        <button
                          key={q.key}
                          type="button"
                          onClick={() => { setQualityKey(q.key); applyAll({ infill: q.infill }); }}
                          className={`rounded-2xl border-2 p-5 text-left transition-all ${
                            sel ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
                          }`}
                        >
                          <Icon className={`w-6 h-6 mb-3 ${sel ? "text-primary" : "text-muted-foreground"}`} />
                          <p className="font-bold text-sm">{q.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{q.desc}</p>
                        </button>
                      );
                    })}
                  </div>

                  <Button className="w-full gap-2" onClick={goNext}>
                    Weiter zur Übersicht <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              )}

              {/* ---------- SCHRITT 6 ---------- */}
              {step === 6 && (
                <div className="space-y-6">
                  <div>
                    <h1 className="font-heading text-2xl md:text-3xl font-extrabold text-foreground mb-1">Übersicht & Bestellen</h1>
                    <p className="text-muted-foreground text-sm">Prüfe deine Auswahl und sende die Anfrage ab.</p>
                  </div>

                  <div className="space-y-3">
                    {calcs.map(({ part: p, calc }) => (
                      <div key={p.id} className="bg-card rounded-2xl border border-border p-4 relative">
                        <button
                          type="button"
                          onClick={() => remove(p.id)}
                          aria-label="Bauteil entfernen"
                          className="absolute top-2 right-2 z-10 bg-background/80 hover:bg-destructive hover:text-destructive-foreground rounded-full p-1.5 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <div className="flex items-start gap-4 pr-8">
                          {p.file ? (
                            <div className="w-20 h-20 rounded-xl bg-muted overflow-hidden shrink-0">
                              <ModelPreview file={p.file} />
                            </div>
                          ) : (
                            <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center shrink-0">
                              <FileText className="w-8 h-8 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">{p.fileName}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {materials.find((m) => m.id === p.materialId)?.name} · {p.color || "Farbe n. A."} · {presetByInfill(p.infill).label}
                            </p>
                            {p.hasVolume && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                ~{calc.weight.toFixed(1)} g · Stückpreis {CHF(calc.unit)}
                              </p>
                            )}
                            <div className="mt-2 flex items-center gap-1">
                              <button onClick={() => update(p.id, { quantity: Math.max(1, p.quantity - 1) })} aria-label="Menge verringern"
                                className="w-8 h-8 rounded-md border border-input flex items-center justify-center hover:bg-muted">
                                <Minus className="w-3 h-3" />
                              </button>
                              <Input type="number" min={1} value={p.quantity}
                                onChange={(e) => update(p.id, { quantity: Math.max(1, Number(e.target.value)) })}
                                className="h-8 w-16 text-center" aria-label="Menge" />
                              <button onClick={() => update(p.id, { quantity: p.quantity + 1 })} aria-label="Menge erhöhen"
                                className="w-8 h-8 rounded-md border border-input flex items-center justify-center hover:bg-muted">
                                <Plus className="w-3 h-3" />
                              </button>
                              <span className="ml-auto text-base font-bold text-primary">
                                {isStepFile(p.fileName) ? "Auf Anfrage" : CHF(calc.subtotal)}
                              </span>
                            </div>
                            {p.quantity >= 4 && p.quantity < 5 && (
                              <p className="mt-2 text-xs text-success font-medium">Ab 5 Stück: 10% Rabatt</p>
                            )}
                            {p.quantity >= 5 && p.quantity < 10 && (
                              <p className="mt-2 text-xs text-success font-medium">10% Rabatt aktiv · Ab 10 Stück: 15% Rabatt</p>
                            )}
                            {p.quantity >= 10 && (
                              <p className="mt-2 text-xs text-success font-medium">15% Mengenrabatt aktiv</p>
                            )}
                          </div>
                        </div>

                        {/* Per-Part Bilder */}
                        <div className="mt-4 pt-3 border-t border-border">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold text-foreground">📷 Bilder zu diesem Teil <span className="text-muted-foreground font-normal">(optional)</span></p>
                            <input id={`part-img-${p.id}`} type="file" multiple accept="image/*" className="hidden"
                              onChange={(e) => { Array.from(e.target.files || []).forEach(f => addPartImage(p.id, f)); e.target.value = ""; }} />
                            <label htmlFor={`part-img-${p.id}`}>
                              <Button asChild variant="outline" size="sm" className="gap-1.5 cursor-pointer h-8 text-xs">
                                <span><Upload className="w-3 h-3" /> Bild hinzufügen</span>
                              </Button>
                            </label>
                          </div>
                          {p.images.length > 0 && (
                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                              {p.images.map(img => (
                                <div key={img.id} className="relative aspect-square rounded-md overflow-hidden border border-border bg-muted group">
                                  <img src={img.previewUrl} alt={img.file.name} className="w-full h-full object-cover" />
                                  {img.uploading && (
                                    <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                    </div>
                                  )}
                                  <button type="button" onClick={() => removePartImage(p.id, img.id)} aria-label="Bild entfernen"
                                    className="absolute top-0.5 right-0.5 bg-background/80 hover:bg-destructive hover:text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Trash2 className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <input id="overview-file-input" type="file" multiple accept=".stl,.3mf,.step,.obj" className="hidden" onChange={handleInput} />
                    <label htmlFor="overview-file-input">
                      <Button asChild variant="outline" className="gap-2 cursor-pointer w-full">
                        <span><Plus className="w-4 h-4" /> Weiteres Teil hinzufügen</span>
                      </Button>
                    </label>
                  </div>



                  {/* Preisübersicht */}
                  <div className="bg-card rounded-2xl border border-border p-5 space-y-2 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Materialkosten</span><span className="text-foreground">{CHF(materialTotal)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Setup-Gebühr</span><span className="text-foreground">{CHF(setupFee)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Versand</span><span className="text-foreground">{shipping === 0 ? "Gratis" : CHF(shipping)}</span>
                    </div>
                    <div className="border-t border-border pt-3 mt-3 flex items-center justify-between">
                      <span className="font-bold">Total</span>
                      <span className="text-xl font-bold text-primary">{hasStep ? "Auf Anfrage" : CHF(total)}</span>
                    </div>
                  </div>

                  {/* Kontaktformular */}
                  <form onSubmit={handleSend} className="bg-card rounded-2xl border border-border p-5 space-y-4">
                    <h3 className="font-heading text-lg font-bold">Deine Kontaktdaten</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Vorname *</Label>
                        <Input required value={form.vorname} onChange={(e) => setForm((f) => ({ ...f, vorname: e.target.value }))} className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs">Nachname *</Label>
                        <Input required value={form.nachname} onChange={(e) => setForm((f) => ({ ...f, nachname: e.target.value }))} className="mt-1" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">E-Mail *</Label>
                        <Input type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs">Telefon *</Label>
                        <Input type="tel" required value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="mt-1" />
                      </div>
                    </div>
                    {!isLoggedIn && (
                      <>
                        <div>
                          <Label className="text-xs">Strasse & Hausnummer *</Label>
                          <Input required value={form.strasse} onChange={(e) => setForm((f) => ({ ...f, strasse: e.target.value }))} className="mt-1" />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label className="text-xs">PLZ *</Label>
                            <Input required value={form.plz} onChange={(e) => setForm((f) => ({ ...f, plz: e.target.value }))} className="mt-1" />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">Ort *</Label>
                            <Input required value={form.ort} onChange={(e) => setForm((f) => ({ ...f, ort: e.target.value }))} className="mt-1" />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">Land</Label>
                          <Input value={form.land} onChange={(e) => setForm((f) => ({ ...f, land: e.target.value }))} className="mt-1" />
                        </div>
                      </>
                    )}
                    <div>
                      <Label className="text-xs">Nachricht (optional)</Label>
                      <Textarea rows={3} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} className="mt-1" />
                    </div>
                    <Button type="submit" className="w-full gap-2" disabled={submitting || parts.length === 0 || parts.some(p => p.uploading)}>
                      {submitting ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Wird gesendet...</>
                      ) : hasStep ? (
                        <><Send className="w-4 h-4" /> Unverbindliche Anfrage senden</>
                      ) : (
                        <><Send className="w-4 h-4" /> Jetzt bestellen</>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      Preise sind Schätzungen. Verbindliches Angebot innerhalb 24h.
                    </p>
                  </form>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

export default CalculatorOnlinePage;
