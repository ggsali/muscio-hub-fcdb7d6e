import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { takePendingUploads } from "@/lib/pendingUpload";
import { useSlicerWorker, type SlicerResult } from "@/hooks/useSlicerWorker";

import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Upload, Trash2, Plus, Minus, Loader2, Send, ArrowRight, ArrowLeft, FileText,
  Check, Zap, Gauge, Shield, Gem, Sparkles, MessageCircle,
  Lock as LockIcon, RotateCcw, Star, Package, Lightbulb, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ModelPreview from "@/components/site/ModelPreview";
import HerkunftBanner from "@/components/site/HerkunftBanner";
import { colorHex } from "@/lib/colorMap";
import JSZip from "jszip";
import Seo from "@/components/site/Seo";
import KiMaterialChat, { KiResult } from "@/components/site/KiMaterialChat";
import { useSettings } from "@/contexts/SettingsContext";
import { useIsMobile } from "@/hooks/use-mobile";

import {
  loadQualityConfig, DEFAULT_QUALITY_PRESETS, DEFAULT_CALC_PARAMS,
  type QualityPreset, type CalcParams,
} from "@/lib/calcConfig";


interface Material {
  id: string;
  name: string;
  materialType?: string;
  pricePerGram: number;
  density: number;
  farbe?: string | null;
  hersteller?: string | null;
  farben: string[];
  farbHex: Record<string, string>;
}


const QUALITY_ICONS: Record<string, typeof Zap> = {
  schnell: Zap,
  standard: Gauge,
  stark: Shield,
  massiv: Gem,
};


interface PartImage {
  id: string;
  file: File;
  storagePath?: string;
  uploading: boolean;
  previewUrl: string;
}

export interface KiAnalysis {
  volumeCm3?: number;
  weightG?: number;
  druckzeit_minuten: number;
  materialkosten: number;
  maschinenkosten: number;
  support_nachbearbeitung: number;
  preis_pro_stueck: number;
  gesamtpreis: number;
  gesamtpreis_min: number;
  gesamtpreis_max: number;
  versand: number;
  hat_support: boolean;
  orientierung: string;
  orientierung_original_ueberhang: number;
  orientierung_beste_ueberhang: number;
  begruendung: string;
  hinweis_fuer_kunden: string;
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
  stlBase64: string | null;
  stlArrayBuffer: ArrayBuffer | null;
  slicerResult: SlicerResult | null;
  slicerLoading: boolean;
  slicerError: string | null;
  kiAnalysis: KiAnalysis | null;
  kiAnalysisLoading: boolean;
  kiAnalysisError: string | null;
  isQuickSlice?: boolean;
  quickSliceResult?: SlicerResult;

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

const calcQuickPrice = (volumeCm3: number, mat: Material, quality: QualityPreset, maschinenzeitProH = 3, minPrice = 5): number => {
  const density = mat.density || 1.24;
  const shellFactor = 0.3;
  const fillFactor = shellFactor + (1 - shellFactor) * (quality.infill / 100);
  const weightG = volumeCm3 * density * fillFactor;
  const materialCost = weightG * mat.pricePerGram;
  const druckzeitMin = weightG * 2.5 * quality.speedFactor;
  const machineCost = (druckzeitMin / 60) * maschinenzeitProH;
  return Math.max(materialCost + machineCost, minPrice);
};


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

/** Anonymes Funnel-Tracking für den Kalkulator */
const trackCalc = (event: string, meta?: Record<string, unknown>) => {
  const sid =
    sessionStorage.getItem("_pv_session") ||
    sessionStorage.getItem("session_id") ||
    "unknown";
  supabase
    .from("calc_events")
    .insert({ session_id: sid, event, meta: meta || {} } as any)
    .then(() => {}, () => {});
};

/** Sekunden -> "2 h 15 min" */
const formatDuration = (seconds: number): string => {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.round((total % 3600) / 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
};

const CalculatorOnlinePage = () => {
  const [step, setStep] = useState(1);
  const [parts, setParts] = useState<Part[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(true);
  const [materialsError, setMaterialsError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [herkunftInquiryId, setHerkunftInquiryId] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [form, setForm] = useState({ vorname: "", nachname: "", email: "", phone: "", strasse: "", plz: "", ort: "", land: "Schweiz", message: "" });
  const [refImages, setRefImages] = useState<Array<{ id: string; file: File; storagePath?: string; uploading: boolean; previewUrl: string }>>([]);

  // Globale Auswahl (gilt für alle hochgeladenen Teile)
  const [materialId, setMaterialId] = useState("");
  const [color, setColor] = useState("");
  const [qualityKey, setQualityKey] = useState("standard");
  const [kiResult, setKiResult] = useState<KiResult | null>(null);
  const [materialMode, setMaterialMode] = useState<null | "ki" | "manual">(null);
  const [kiChatOpen, setKiChatOpen] = useState(true);
  const [chatKey, setChatKey] = useState(0);
  // Schnell-Schätzung (Einstieg von der Startseite): grober Preis vor dem geführten Prozess
  const [quickMode, setQuickMode] = useState(false);
  // Wert-Kommunikation & Social Proof
  const [calcReviews, setCalcReviews] = useState<Array<{ id: string; customer_name: string; kommentar: string | null; rating: number }>>([]);
  const [priceFlash, setPriceFlash] = useState(false);
  useEffect(() => {
    supabase.from("public_reviews")
      .select("id, customer_name, kommentar, rating")
      .eq("rating", 5)
      .limit(12)
      .then(({ data }) => {
        if (!data) return;
        const withText = (data as typeof calcReviews).filter((r) => r.kommentar && r.kommentar.trim().length > 10);
        setCalcReviews([...withText].sort(() => Math.random() - 0.5).slice(0, 3));
      });
  }, []);

  // Analyse-Fortschritt simulieren
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isAnalysingRef = useRef(false);

  const startProgress = useCallback(() => {
    if (isAnalysingRef.current && progressIntervalRef.current) return; // läuft bereits
    isAnalysingRef.current = true;
    setAnalysisProgress(5);

    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

    progressIntervalRef.current = setInterval(() => {
      setAnalysisProgress((prev) => {
        if (prev >= 88) {
          clearInterval(progressIntervalRef.current!);
          return 88; // Wartet auf echtes Fertig-Signal
        }
        return Math.min(prev + Math.random() * 5 + 1, 88);
      });
    }, 600);
  }, []);

  const finishProgress = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    isAnalysingRef.current = false;
    setAnalysisProgress(100);
  }, []);

  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

  // Echter Status-Monitor: 100% erst wenn Slicer UND KI-Analyse fertig sind
  useEffect(() => {
    const anyLoading = parts.some((p) => p.slicerLoading || p.kiAnalysisLoading);
    const anyStarted = parts.some((p) =>
      p.fileName && (p.slicerResult || p.kiAnalysis || p.slicerError || p.kiAnalysisError)
    );

    if (anyLoading) {
      if (!isAnalysingRef.current) {
        startProgress();
      }
    } else if (anyStarted && !anyLoading) {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      isAnalysingRef.current = false;
      setAnalysisProgress(100);
    }
  }, [parts.map((p) => `${p.slicerLoading}-${p.kiAnalysisLoading}`).join(",")]);

  // Nach 2 Sekunden bei 100% ausblenden
  useEffect(() => {
    if (analysisProgress === 100) {
      const t = setTimeout(() => setAnalysisProgress(0), 2000);
      return () => clearTimeout(t);
    }
  }, [analysisProgress]);

  // Preis-Badge kurz grün aufleuchten lassen, wenn Slicer-Ergebnis fertig wird
  useEffect(() => {
    const anyJustFinished = parts.some((p) => p.slicerResult && !p.isQuickSlice && !p.slicerLoading);
    if (anyJustFinished) {
      setPriceFlash(true);
      const t = setTimeout(() => setPriceFlash(false), 300);
      return () => clearTimeout(t);
    }
  }, [parts.map((p) => `${p.slicerResult?.filamentGrams ?? 0}-${p.isQuickSlice}-${p.slicerLoading}`).join(",")]);


  const isMobile = useIsMobile();
  const { slice } = useSlicerWorker();


  const { settings } = useSettings();

  // Qualitäts-Presets & Kalkulationsparameter aus den Einstellungen (Fallback: Hardcode)
  const [qualityPresets, setQualityPresets] = useState<QualityPreset[]>(DEFAULT_QUALITY_PRESETS);
  const [calcParams, setCalcParams] = useState<CalcParams>(DEFAULT_CALC_PARAMS);
  useEffect(() => {
    loadQualityConfig().then(({ presets, params }) => {
      setQualityPresets(presets);
      setCalcParams(params);
      console.log("Geladene Qualitäts-Presets:", presets, "Kalkulationsparameter:", params);
    });
  }, []);

  useEffect(() => {
    console.log("Maschinenzeit:", settings.maschinenzeit_pro_h);
  }, [settings.maschinenzeit_pro_h]);

  const presetByInfill = useCallback(
    (infill: number) => qualityPresets.find((q) => q.infill === infill) || qualityPresets[1],
    [qualityPresets],
  );
  const qualityAdminLabel = useCallback(
    (infill: number) => {
      const q = presetByInfill(infill);
      return `${q.label} (${q.layerHeight}mm, ${q.infill}% Infill)`;
    },
    [presetByInfill],
  );

  const activeQuality = useMemo(
    () => qualityPresets.find((q) => q.key === qualityKey) || qualityPresets[1],
    [qualityKey, qualityPresets],
  );




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
    const { data: filaments, error } = await supabase
      .from("filaments")
      .select("id, name, material, farbe, farben, hersteller, verkaufspreis_pro_g, preis_pro_kg, dichte_g_cm3, aktiv")
      .eq("aktiv", true)
      .order("material", { ascending: true });

    console.log("[Kalkulator] Filamente geladen:", filaments?.length, filaments);
    console.log("[Filamente]", filaments?.map((f: any) => ({ id: f.id, name: f.name, material: f.material })));

    if (error || !filaments || filaments.length === 0) {
      console.warn("[Kalkulator] Keine Filamente – Fallback auf materials-Tabelle");
      const { data: mats } = await supabase
        .from("materials")
        .select("*")
        .eq("aktiv", true)
        .order("sort_order");

      const fallback: Material[] = (mats ?? []).map((m: any) => ({
        id: m.id,
        name: m.name,
        materialType: m.tag || m.name,
        pricePerGram: Number(m.price_per_gram),
        density: Number(m.density) || 1.24,
        farbe: null,
        hersteller: null,
        farben: Array.isArray(m.farben) ? m.farben : [],
        farbHex: {},
      }));


      if (fallback.length === 0) {
        setMaterialsError("Materialien konnten nicht geladen werden.");
        toast.warning("Keine aktiven Filamente in der Bibliothek gefunden – bitte im Admin unter Filamente prüfen.");
      } else {
        setMaterialsError(null);
      }

      setMaterials(fallback);
      setMaterialsLoading(false);
      return;
    }

    // Filamente mit Preis 0 oder fehlendem Preis filtern
    const validFilaments = filaments.filter((f: any) => {
      const preis = f.verkaufspreis_pro_g
        ? Number(f.verkaufspreis_pro_g)
        : f.preis_pro_kg
          ? (Number(f.preis_pro_kg) / 1000) * 2.5
          : 0;
      return preis > 0;
    });

    setMaterialsError(null);
    setMaterials(
      validFilaments.map((f: any) => {
        const raw = Array.isArray(f.farben) ? f.farben : [];
        const list = raw
          .map((c: any) =>
            typeof c === "string"
              ? { name: c, hex: c.startsWith("#") ? c : "" }
              : { name: String(c?.name ?? ""), hex: String(c?.hex ?? "") },
          )
          .filter((c: any) => c.name);
        if (list.length === 0 && f.farbe) {
          list.push({ name: f.farbe, hex: String(f.farbe).startsWith("#") ? f.farbe : "" });
        }
        const farbHex: Record<string, string> = {};
        list.forEach((c: any) => { if (c.hex) farbHex[c.name] = c.hex; });
        return {
          id: f.id,
          name: f.name,
          materialType: f.material,
          pricePerGram: f.verkaufspreis_pro_g
            ? Number(f.verkaufspreis_pro_g)
            : (Number(f.preis_pro_kg) / 1000) * 2.5,
          density: Number(f.dichte_g_cm3) || 1.24,
          farbe: list[0]?.hex || f.farbe,
          hersteller: f.hersteller,
          farben: list.map((c: any) => c.name),
          farbHex,
        };
      }),
    );


    setMaterialsLoading(false);
  }, []);


  useEffect(() => {
    setMaterialsLoading(true);
    loadMaterials();
    const channel = supabase
      .channel("filaments-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "filaments" }, () => {
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

  /** KI-/Slicer-Analyse für ein Teil (Edge Function analyze-stl) */
  const runKiAnalysisNow = useCallback(async (partId: string) => {
    const part = parts.find((p) => p.id === partId);
    if (!part?.stlBase64 || isStepFile(part.fileName)) return;
    const mat = materials.find((m) => m.id === (part.materialId || materials[0]?.id));
    if (!mat) return;
    const quality = qualityPresets.find((q) => q.key === qualityKey) ?? qualityPresets[1];

    setParts((prev) => prev.map((p) => p.id === partId
      ? { ...p, kiAnalysisLoading: true, kiAnalysisError: null }
      : p));

    const { data, error } = await supabase.functions.invoke("analyze-stl", {
      body: {
        stlBase64: part.stlBase64,
        fileName: part.fileName || "teil.stl",
        material: mat.materialType || mat.name.split(" ")[0],
        pricePerGram: mat.pricePerGram,
        qualityKey: quality.key,
        layerHeight: quality.layerHeight,
        infill: quality.infill,
        speedFactor: quality.speedFactor,
        quantity: part.quantity,
        maschinenzeit: settings.maschinenzeit_pro_h || 3,
        setupFee: calcParams.fix_cost || 20,
        minPrice: calcParams.min_price || 5,
        minuten_pro_gramm: 2.5,
        overhang_schwellwert: 30,
        komplexitaets_aufschlag: 20,
        versandkosten: SHIPPING_COST,
        versandkostenfrei_ab: SHIPPING_FREE_FROM,
      },
    });

    if (error || !data || (data as any).error) {
      console.warn("KI-Analyse fehlgeschlagen", error || (data as any)?.error);
      setParts((prev) => prev.map((p) => p.id === partId
        ? { ...p, kiAnalysisLoading: false, kiAnalysisError: "Analyse fehlgeschlagen – vereinfachte Schätzung wird verwendet" }
        : p));
    } else {
      setParts((prev) => prev.map((p) => p.id === partId
        ? { ...p, kiAnalysis: data as KiAnalysis, kiAnalysisLoading: false, kiAnalysisError: null }
        : p));
    }
  }, [parts, materials, qualityPresets, qualityKey, settings.maschinenzeit_pro_h, calcParams]);

  const kiFnRef = useRef(runKiAnalysisNow);
  useEffect(() => { kiFnRef.current = runKiAnalysisNow; }, [runKiAnalysisNow]);
  const kiTimers = useRef<Record<string, number>>({});

  /** 300 ms Debounce pro Teil */
  const runKiAnalysis = useCallback((partId: string) => {
    window.clearTimeout(kiTimers.current[partId]);
    kiTimers.current[partId] = window.setTimeout(() => { void kiFnRef.current(partId); }, 300);
  }, []);

  const runKiAnalysisAll = useCallback(() => {
    parts.forEach((p) => { if (p.stlBase64) runKiAnalysis(p.id); });
  }, [parts, runKiAnalysis]);

  /** Browser-Slicing via three-slicer Web Worker (OrcaSlicer-Kernel) */
  const runSlicerNow = useCallback(async (partId: string, quickSlice = false) => {
    const part = parts.find((p) => p.id === partId);
    if (!part?.stlArrayBuffer || isStepFile(part.fileName)) return;

    const mat = materials.find((m) => m.id === (part.materialId || materials[0]?.id));

    // QuickSlice: immer 0.3mm und 15% Infill für schnellen Sofortpreis
    const quality = quickSlice
      ? { layerHeight: 0.3, infill: 15, speedFactor: 0.7, key: "quick" }
      : (qualityPresets.find((q) => q.key === qualityKey) ?? qualityPresets[1]);

    setParts((prev) => prev.map((p) => p.id === partId
      ? { ...p, slicerLoading: true, slicerError: null, isQuickSlice: quickSlice }
      : p));

    try {
      const result = await slice(part.stlArrayBuffer.slice(0), {
        material: mat?.materialType || mat?.name.split(" ")[0] || "PLA",
        layerHeight: quality.layerHeight,
        infill: quality.infill,
        speedFactor: quality.speedFactor,
        density: mat?.density,
      });
      console.log("[Slicer]", result);
      setParts((prev) => prev.map((p) => p.id === partId
        ? {
            ...p,
            slicerResult: result,
            slicerLoading: false,
            isQuickSlice: quickSlice,
            quickSliceResult: quickSlice ? result : p.quickSliceResult,
          }
        : p));
    } catch (err: any) {
      console.error("[Slicer Error]", err);
      setParts((prev) => prev.map((p) => p.id === partId
        ? { ...p, slicerLoading: false, slicerError: "Slicer nicht verfügbar – Schätzung wird verwendet" }
        : p));
    }
  }, [parts, materials, qualityPresets, qualityKey, slice]);

  const slicerFnRef = useRef(runSlicerNow);
  useEffect(() => { slicerFnRef.current = runSlicerNow; }, [runSlicerNow]);
  const slicerTimers = useRef<Record<string, number>>({});

  const runSlicer = useCallback((partId: string, quickSlice = false) => {
    window.clearTimeout(slicerTimers.current[partId]);
    slicerTimers.current[partId] = window.setTimeout(() => { void slicerFnRef.current(partId, quickSlice); }, 300);
  }, []);

  const runSlicerAll = useCallback((quickSlice = false) => {
    parts.forEach((p) => { if (p.stlArrayBuffer) runSlicer(p.id, quickSlice); });
  }, [parts, runSlicer]);


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
        stlBase64: null,
        stlArrayBuffer: null,
        slicerResult: null,
        slicerLoading: ext === "stl",
        slicerError: null,
        kiAnalysis: null,
        kiAnalysisLoading: ext === "stl",
        kiAnalysisError: null,
      },
    ]);

    // STL als ArrayBuffer (Slicer) und Base64 (Edge-Function-Fallback) speichern
    if (ext === "stl") {
      startProgress();
      try {
        const arrayBuffer = await file.arrayBuffer();
        setParts((p) => p.map((x) => (x.id === id ? { ...x, stlArrayBuffer: arrayBuffer } : x)));
        runSlicer(id, true); // QuickSlice für schnellen Sofortpreis
      } catch (e) {
        console.warn("STL konnte nicht gelesen werden", e);
        setParts((p) => p.map((x) => (x.id === id ? { ...x, slicerLoading: false } : x)));
      }
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });
        setParts((p) => p.map((x) => (x.id === id ? { ...x, stlBase64: base64 } : x)));
        runKiAnalysis(id);
      } catch (e) {
        console.warn("Base64-Kodierung fehlgeschlagen", e);
        setParts((p) => p.map((x) => (x.id === id ? { ...x, kiAnalysisLoading: false } : x)));
      }
    }



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
      trackCalc("schritt_1_datei_hochgeladen", { fileName: file.name, ext });

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
  }, [materials, runKiAnalysis]);

  // Dateien, die auf einer anderen Seite (Hero-Dropzone, Mobile-CTA) gewählt wurden
  const pendingHandled = useRef(false);
  useEffect(() => {
    if (pendingHandled.current) return;

    const handle = () => {
      const files = takePendingUploads();
      if (files.length === 0) return;
      pendingHandled.current = true;
      setQuickMode(true);
      files.forEach(addFile);
    };

    if (materials.length > 0) {
      handle();
      return;
    }

    const timeout = setTimeout(handle, 3000);
    return () => clearTimeout(timeout);
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

  const confirmQuality = (key: string, infill: number) => {
    trackCalc("schritt_4_qualitaet_gewaehlt", { qualitaet: qualityPresets.find(q => q.key === key)?.label || key });
    setQualityKey(key);
    applyAll({ infill });
    startProgress();
    runKiAnalysisAll();

    const quality = qualityPresets.find((q) => q.key === key);
    // Nur neu slicen wenn sich Qualität vom QuickSlice unterscheidet
    if (quality && quality.layerHeight !== 0.3) {
      parts.forEach((p) => {
        if (p.stlArrayBuffer && !isStepFile(p.fileName)) {
          runSlicer(p.id, false); // genauer Slice mit echter Qualität
        }
      });
    }
  };

  const MIN_PRICE = calcParams.min_price;
  const FIX_COST = calcParams.fix_cost;
  const SUPPORT_SURCHARGE = calcParams.support_surcharge;

  /** Slicer-Daten bevorzugt, dann KI-Analyse, sonst geometrische Schätzung (Setup separat 1× pro Bestellung) */
  const calcPart = (p: Part) => {
    const mat = materials.find((m) => m.id === p.materialId);

    let discount = 0;
    if (p.quantity >= 10) discount = 0.15;
    else if (p.quantity >= 5) discount = 0.1;

    // 1) Echte Slicer-Daten
    if (p.slicerResult && !p.slicerLoading && mat && p.slicerResult.filamentGrams > 0) {
      const weightG = p.slicerResult.filamentGrams;
      const druckzeitMin = p.slicerResult.printTimeMinutes ||
        weightG * 2.5 * (presetByInfill(p.infill).speedFactor || 1);
      const materialCost = weightG * mat.pricePerGram;
      const machineCost = (druckzeitMin / 60) * (settings.maschinenzeit_pro_h || 3);
      const supportCost = p.slicerResult.hasSupport ? (SUPPORT_SURCHARGE || 2.5) : 0;
      const unit = materialCost + machineCost + supportCost;
      return {
        weight: weightG,
        unit,
        subtotal: Math.max(unit * p.quantity * (1 - discount), 0),
        discount,
        exact: true,
        druckzeitMin,
      };
    }

    // 2) KI-Analyse (Edge Function als Fallback)
    if (p.kiAnalysis && !p.kiAnalysisLoading) {
      const unit = p.kiAnalysis.preis_pro_stueck;
      return {
        weight: p.kiAnalysis.weightG ?? p.estimatedWeight,
        unit,
        subtotal: Math.max(unit * p.quantity * (1 - discount), 0),
        discount,
        exact: true,
        kiMin: p.kiAnalysis.gesamtpreis_min,
        kiMax: p.kiAnalysis.gesamtpreis_max,
      };
    }

    if (!mat || !p.hasVolume || p.estimatedWeight <= 0) {
      return { weight: 0, unit: 0, subtotal: 0, discount: 0, exact: false };
    }

    const weight = p.estimatedWeight;
    const quality = presetByInfill(p.infill);

    // Materialkosten (aus filaments.verkaufspreis_pro_g)
    const materialCost = weight * mat.pricePerGram;

    // Maschinenzeit schätzen
    const baseHours = (weight / 10) * quality.speedFactor;
    const machineCost = baseHours * (settings.maschinenzeit_pro_h || 3.0);

    const unit = materialCost + machineCost;

    const subtotal = Math.max(unit * p.quantity * (1 - discount), 0);
    return { weight, unit, subtotal, discount, exact: false };
  };



  const calcs = parts.map((p) => ({ part: p, calc: calcPart(p) }));

  const kiLoading = parts.some((p) => p.kiAnalysisLoading || p.slicerLoading);

  const materialTotal = calcs.reduce((s, { calc }) => s + calc.subtotal, 0);
  const setupFee = parts.length > 0 ? (FIX_COST || 20) : 0;
  const subtotal = materialTotal + setupFee;
  const shipping = subtotal === 0 ? 0 : subtotal >= SHIPPING_FREE_FROM ? 0 : SHIPPING_COST;
  const total = Math.max(subtotal + shipping, MIN_PRICE || 5.0);
  const totalMin = Math.round(total * 0.9 * 100) / 100;
  const totalMax = Math.round(total * 1.15 * 100) / 100;
  const hasKiAnalysis = parts.some((p) => p.kiAnalysis || p.slicerResult);

  // Aggregierte Werte für die Wert-Kommunikation (nur Anzeige)
  const totalGrams = calcs.reduce((s, { part, calc }) => s + calc.weight * part.quantity, 0);
  const totalHours = calcs.reduce((s, { part, calc }) => {
    const min = part.slicerResult?.printTimeMinutes || part.kiAnalysis?.druckzeit_minuten;
    const hours = min != null ? min / 60 : (calc.weight / 10) * presetByInfill(part.infill).speedFactor;
    return s + hours * part.quantity;
  }, 0);



  const hasStep = parts.some((p) => isStepFile(p.fileName));
  const selectedMaterial = materials.find((m) => m.id === materialId) || null;
  const availableColors = selectedMaterial?.farben || [];
  const groupedMaterials = useMemo(
    () =>
      materials.reduce((acc, m) => {
        const key = m.materialType || m.name.split(" ")[0];
        if (!acc[key]) acc[key] = [];
        acc[key].push(m);
        return acc;
      }, {} as Record<string, Material[]>),
    [materials],
  );

  // Schritt 1 wechselt NICHT automatisch — der Nutzer kann beliebig viele Teile
  // hinzufügen und klickt selbst auf "Weiter".

  // Schnell-Schätzung: sobald analysiert, globales Material auf Standard setzen
  const quickReady = quickMode && parts.length > 0 && !kiLoading
    && parts.every((p) => p.hasVolume || isStepFile(p.fileName));

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

  const chooseMaterial = (id: string, fromKi = false) => {
    const matName = materials.find((m) => m.id === id)?.name || id;
    trackCalc(fromKi ? "schritt_2_ki_empfehlung_uebernommen" : "schritt_2_material_manuell_gewaehlt", { material: matName });
    setMaterialId(id);
    const mat = materials.find((m) => m.id === id);
    const firstColor = mat?.farben?.[0] || "";
    setColor((c) => (mat?.farben?.includes(c) ? c : firstColor));
    applyAll({ materialId: id });
    startProgress();
    runKiAnalysisAll();
    runSlicerAll();
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

  // Kompakte Admin-Zusammenfassung per KI erzeugen (kein Gesprächsverlauf)
  const buildKiSummary = async (): Promise<string | null> => {
    if (!kiResult) return null;
    const fallback = `Empfohlenes Material: ${kiResult.material}\nGrund: ${kiResult.begruendung}`;
    try {
      const { data, error } = await supabase.functions.invoke("ki-materialberatung", {
        body: { mode: "summary", transcript: kiResult.transcript },
      });
      if (error || !data?.zusammenfassung) return fallback;
      return String(data.zusammenfassung).trim();
    } catch {
      return fallback;
    }
  };

  const canNext =
    (step === 1 && parts.length > 0) ||
    step === 2 ||
    (step === 3 && !!materialId) ||
    (step === 4 && (!!color || availableColors.length === 0)) ||
    step === 5;

  const goNext = useCallback(() => {
    setStep((s) => Math.min(STEPS.length, s + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  const goBack = useCallback(() => {
    setStep((s) => {
      if (s === STEPS.length) trackCalc("schritt_5_abgebrochen");
      return Math.max(1, s - 1);
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const summary = parts
        .map((p) => `${p.fileName} (${p.quantity}× ${(materials.find(m => m.id === p.materialId)?.name || p.materialId)}, ${p.color}, ${qualityAdminLabel(p.infill)})`)
        .join("; ");
      const { data: { user } } = await supabase.auth.getUser();
      let resolvedVorname = form.vorname.trim();
      let resolvedNachname = form.nachname.trim();
      let resolvedEmail = form.email.trim();
      let resolvedPhone = form.phone.trim();
      if (user) {
        if (!resolvedEmail) resolvedEmail = user.email || "";
        if (!resolvedVorname && !resolvedNachname) {
          const full = (user.user_metadata?.full_name as string) || "";
          const ps = full.trim().split(/\s+/);
          resolvedVorname = ps[0] || user.email || "Kunde";
          resolvedNachname = ps.slice(1).join(" ") || "";
        }
      }
      const resolvedName = `${resolvedVorname} ${resolvedNachname}`.trim() || resolvedEmail || "Kunde";
      const addressLine = !user && (form.strasse || form.plz || form.ort)
        ? `\n\nAdresse: ${form.strasse}, ${form.plz} ${form.ort}, ${form.land}`
        : "";
      const kiSummaryText = await buildKiSummary();
      const kiBlock = kiSummaryText ? `\n\n--- KI-Materialberatung ---\n${kiSummaryText}` : "";
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

      const { data, error } = await supabase.functions.invoke("submit-inquiry", {
        body: {
          name: resolvedName,
          email: resolvedEmail,
          telefon: resolvedPhone || null,
          betreff: "Preisanfrage Kalkulator",
          nachricht,
          strasse: form.strasse || null,
          plz: form.plz || null,
          ort: form.ort || null,
          land: form.land || "Schweiz",
          attachments,
          ki_beratung_zusammenfassung: kiSummaryText,
          ki_empfohlenes_material: kiResult?.material ?? null,
        },
      });
      if (error || !data?.success) throw new Error(error?.message || data?.error || "Fehler beim Senden");

      trackCalc("schritt_5_bestellung_abgesendet", { teile: parts.length });

      toast.success("Anfrage gesendet! Wir melden uns innerhalb 24h.");

      // Herkunfts-Frage vorbereiten (nur einmal pro Sitzung)
      if (data?.inquiry_id && sessionStorage.getItem("herkunft_gefragt") !== "true") {
        setHerkunftInquiryId(data.inquiry_id as string);
      }

      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });

      setForm({ vorname: "", nachname: "", email: "", phone: "", strasse: "", plz: "", ort: "", land: "Schweiz", message: "" });
      setParts([]);
      refImages.forEach(r => { if (r.previewUrl) URL.revokeObjectURL(r.previewUrl); });
      setRefImages([]);
      setKiResult(null);
      setMaterialId("");
      setColor("");
      setQualityKey("standard");

      sessionStorage.removeItem("ki_chat_messages");
      setChatKey((k) => k + 1);
    } catch (err) {
      console.error(err);
      toast.error("Fehler beim Senden — bitte später erneut versuchen.");
    } finally {
      setSubmitting(false);
    }
  };

  const hasSlicerResult = parts.some((p) => p.slicerResult);
  const allSlicerFinished = parts.length > 0 && parts.every((p) => !p.slicerLoading);
  const anySlicerLoading = parts.some((p) => p.slicerLoading);
  const anySlicerError = parts.some((p) => p.slicerError);

  // Sofortpreis aus geometrischer Schätzung (bevor Slicer fertig ist)
  const quickTotal = useMemo(() => {
    if (parts.length === 0 || hasStep) return 0;
    const quality = qualityPresets.find((q) => q.key === qualityKey) ?? qualityPresets[1];
    let sum = 0;
    parts.forEach((p) => {
      const mat = materials.find((m) => m.id === (p.materialId || materials[0]?.id));
      if (!mat || !p.hasVolume || p.volumeCm3 <= 0) return;
      const unit = calcQuickPrice(p.volumeCm3, mat, quality, settings.maschinenzeit_pro_h || 3, calcParams.min_price);
      sum += unit * p.quantity;
    });
    const setup = parts.length > 0 ? (calcParams.fix_cost || 20) : 0;
    const sub = sum + setup;
    const ship = sub === 0 ? 0 : sub >= SHIPPING_FREE_FROM ? 0 : SHIPPING_COST;
    return Math.max(sub + ship, calcParams.min_price || 5);
  }, [parts, materials, qualityKey, qualityPresets, settings.maschinenzeit_pro_h, calcParams, hasStep]);

  const priceBadge = parts.length === 0 || hasStep ? null : quickTotal;

  const canGoNext = step === 1
    ? parts.length > 0 && parts.every((p) => p.hasVolume || isStepFile(p.fileName))
    : step === 2 ? true
    : step === 3 ? !!materialId
    : step === 4 ? !!color
    : step === 5 ? !kiLoading
    : true;

  // Realistisches Lieferdatum aus echter Auftragslast (Edge Function)
  const [lieferdatum, setLieferdatum] = useState<Date | null>(null);
  const neuerAuftragSekunden = useMemo(
    () => parts.reduce((sum, p) => sum + (p.slicerResult?.printTimeMinutes || 0) * 60, 0),
    [parts],
  );

  useEffect(() => {
    if (step < 5 || neuerAuftragSekunden <= 0) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.functions.invoke("calc-lieferzeit", {
        body: { neuer_auftrag_sekunden: neuerAuftragSekunden },
      });
      if (cancelled || error || !data?.lieferdatum) return;
      setLieferdatum(new Date(data.lieferdatum));
    })();
    return () => {
      cancelled = true;
    };
  }, [step, neuerAuftragSekunden]);

  const getDeliveryText = () => {
    if (lieferdatum) {
      return `⚡ Jetzt bestellen → Lieferung ${lieferdatum.toLocaleDateString("de-CH", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })}`;
    }
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    const isWeekday = day >= 1 && day <= 5;
    if (isWeekday && hour >= 8 && hour < 17) {
      const delivery = new Date(now);
      delivery.setDate(delivery.getDate() + 2);
      return `Jetzt bestellen → Lieferung ${delivery.toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long' })}`;
    } else if (isWeekday) {
      return "Heute noch bestellen → Lieferung in 48h";
    } else {
      return "Montag bestellen → Lieferung Mittwoch";
    }
  };


  return (
    <div className="pb-20">
      <Seo
        title="3D Druck Kosten berechnen – Sofortpreis online | 3DMuscio"
        description="Berechnen Sie Ihren 3D Druckauftrag sofort und kostenlos. Preis in Sekunden, kein Anmelden nötig. FDM & SLA Druck ab CHF 5.– | 3DMuscio Schweiz"
        path="/kalkulator-online"
      />

      {!submitted && (
        /* Sticky Stepper-Header */
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
                              ? "bg-success text-white"
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
              <div className="flex flex-col items-end gap-1.5">
                <div
                  className={`px-5 py-2.5 rounded-2xl font-bold text-lg sm:text-xl tabular-nums shadow-sm flex items-center gap-2 transition-transform duration-300 ${
                    kiLoading || priceBadge !== null ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  } ${priceFlash ? "scale-105 !bg-green-500 !text-white" : ""}`}
                >
                  {kiLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Analysiert…</>
                  ) : hasStep
                    ? "Preis nach Prüfung"
                    : priceBadge !== null
                      ? (allSlicerFinished && hasSlicerResult ? `ab ${CHF(totalMin)}` : `ca. ${CHF(quickTotal)}`)
                      : "CHF –.–"}
                  {anySlicerLoading && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  {allSlicerFinished && hasSlicerResult && !anySlicerError ? (
                    <span className="ml-1 text-[10px] font-medium bg-primary-foreground/20 text-primary-foreground px-1.5 py-0.5 rounded-full">
                      ✓ Analysiert
                    </span>
                  ) : priceBadge !== null && !hasStep ? (
                    <span className="ml-1 text-[10px] font-medium bg-primary-foreground/20 text-primary-foreground px-1.5 py-0.5 rounded-full">
                      ~ Schätzung
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground flex-wrap justify-end">
                  <span>🇨🇭 Swiss Made</span>
                  <span>·</span>
                  <span>⚡ 48h Lieferung</span>
                  <span className="hidden sm:inline">·</span>
                  <span className="hidden sm:inline">✓ Ab 1 Stück</span>
                  <span className="hidden md:inline">·</span>
                  <span className="hidden md:inline">↩️ Nachbesserung inklusive</span>
                </div>
              </div>


            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 max-w-4xl pt-8 pb-24 lg:pb-0">
        {submitted ? (
          <SuccessView
            inquiryId={herkunftInquiryId}
            onHerkunftSaved={() => setHerkunftInquiryId(null)}
          />
        ) : materialsLoading ? (
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
                      <div className="font-heading text-3xl md:text-4xl font-extrabold text-primary tabular-nums my-4">
                        {hasKiAnalysis ? `ca. ${CHF(totalMin)} – ${CHF(totalMax)}` : `ca. ${CHF(total)}`}
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
                    <input id="quick-file-input" type="file" multiple accept=".stl,.3mf,.step,.obj,model/stl,model/x.stl-ascii,model/x.stl-binary,application/sla,application/vnd.ms-pki.stl,application/octet-stream,*/*" className="hidden" onChange={handleInput} />
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
                        onClick={() => { setQuickMode(false); setStep(2); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                      >
                        Ja, genaue Analyse starten <ArrowRight className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => { setQuickMode(false); setStep(1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
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

                  {/* Hochgeladene Parts */}
                  {parts.filter(p => p.hasVolume || isStepFile(p.fileName)).length > 0 && (
                    <div className="space-y-3">
                      {parts.filter(p => p.hasVolume || isStepFile(p.fileName)).map((p) => (
                        <div key={p.id} className="bg-card border border-border rounded-2xl p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <FileText className="w-5 h-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm truncate">{p.fileName}</p>
                              <p className="text-xs text-muted-foreground">
                                {isStepFile(p.fileName)
                                  ? "STEP-Datei – manuelle Prüfung"
                                  : p.slicerResult
                                    ? `${p.slicerResult.filamentGrams.toFixed(0)}g · ${(p.slicerResult.printTimeMinutes / 60).toFixed(1)}h · ${p.slicerResult.hasSupport ? "⚠️ Support" : "✅ Kein Support"}`
                                    : `${p.volumeCm3.toFixed(1)} cm³ · ca. ${p.estimatedWeight.toFixed(1)}g`}
                              </p>
                            </div>
                            {p.slicerLoading ? (
                              <div className="text-right flex-shrink-0">
                                <Loader2 className="w-4 h-4 animate-spin text-primary mx-auto" />
                              </div>
                            ) : p.slicerResult ? (
                              <div className="text-right flex-shrink-0">
                                <p className="font-bold text-sm text-primary">
                                  ab {CHF(calcPart(p).unit)}
                                </p>
                              </div>
                            ) : (
                              <div className="text-right flex-shrink-0">
                                <p className="font-bold text-sm text-primary">
                                  ca. {CHF(calcQuickPrice(p.volumeCm3, materials.find((m) => m.id === (p.materialId || materials[0]?.id)) || materials[0], qualityPresets.find((q) => q.key === qualityKey) ?? qualityPresets[1], settings.maschinenzeit_pro_h || 3, calcParams.min_price))}
                                </p>
                              </div>
                            )}
                            <button onClick={() => remove(p.id)} className="text-muted-foreground hover:text-destructive ml-1" aria-label="Datei entfernen">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          {p.slicerLoading && (
                            <div className="flex items-center gap-2 mt-2">
                              <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
                                <div className="bg-primary/50 h-1 rounded-full animate-pulse w-full" />
                              </div>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">Analysiert...</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Dropzone */}
                  {parts.length === 0 ? (
                    <div
                      onDrop={handleDrop}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all ${
                        dragOver ? "border-primary bg-primary/5" : "border-border bg-card"
                      }`}
                    >
                      <input id="file-input" type="file" multiple accept=".stl,.3mf,.step,.obj,model/stl,model/x.stl-ascii,model/x.stl-binary,application/sla,application/vnd.ms-pki.stl,application/octet-stream,*/*" className="hidden" onChange={handleInput} />
                      <Upload className="w-12 h-12 text-primary mx-auto mb-4" />
                      <h2 className="font-heading text-xl font-bold text-foreground mb-2">Dateien hierher ziehen</h2>
                      <p className="text-sm text-muted-foreground mb-4">STL, 3MF, STEP, OBJ — bis 500MB pro Datei</p>
                      <label htmlFor="file-input">
                        <Button asChild className="gap-2 cursor-pointer">
                          <span><Upload className="w-4 h-4" /> Dateien auswählen</span>
                        </Button>
                      </label>
                    </div>
                  ) : (
                    <div
                      onDrop={handleDrop}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      className={`border-2 border-dashed rounded-2xl p-4 text-center transition-colors cursor-pointer ${
                        dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                      }`}
                      onClick={() => document.getElementById("step1-add-file")?.click()}
                    >
                      <input id="step1-add-file" type="file" multiple accept=".stl,.3mf,.step,.obj,model/stl,model/x.stl-ascii,model/x.stl-binary,application/sla,application/vnd.ms-pki.stl,application/octet-stream,*/*" className="hidden" onChange={handleInput} />
                      <p className="text-sm text-muted-foreground">
                        <span className="text-primary font-medium">+ Weitere Datei hochladen</span>
                        <span className="hidden sm:inline"> (STL, STEP, 3MF, OBJ)</span>
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

                  <div className="rounded-2xl border border-success/30 bg-success/10 p-4 text-sm">
                    <p className="font-semibold text-foreground flex items-center gap-1.5"><Package className="w-4 h-4 text-success" /> Mehr bestellen = mehr sparen</p>
                    <p className="text-muted-foreground mt-1">5+ Stück → 10% Rabatt · 10+ Stück → 15% Rabatt</p>
                  </div>


                  {parts.length > 0 && (
                    <div className="fixed bottom-0 left-0 right-0 lg:relative lg:bottom-auto z-40 lg:z-auto bg-background/95 backdrop-blur-sm lg:bg-transparent lg:backdrop-blur-none border-t border-border lg:border-none p-4 lg:p-0"
                      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}>
                      <Button
                        onClick={goNext}
                        disabled={!canGoNext}
                        className="w-full lg:w-auto"
                        size="lg"
                      >
                        Weiter → {STEPS[step] || ""}
                      </Button>
                    </div>
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

                  <div className="fixed bottom-0 left-0 right-0 lg:relative lg:bottom-auto z-40 lg:z-auto bg-background/95 backdrop-blur-sm lg:bg-transparent lg:backdrop-blur-none border-t border-border lg:border-none p-4 lg:p-0"
                    style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}>
                    <Button
                      onClick={goNext}
                      disabled={!canGoNext}
                      className="w-full lg:w-auto"
                      size="lg"
                    >
                      Weiter → {STEPS[step] || ""}
                    </Button>
                  </div>
                </div>
              )}


              {/* ---------- SCHRITT 3 ---------- */}
              {step === 3 && (
                <div className="space-y-6">
                  <div>
                    <h1 className="font-heading text-2xl md:text-3xl font-extrabold text-foreground mb-1">Material wählen</h1>
                    <p className="text-muted-foreground text-sm">
                      {materialMode === null
                        ? "Möchtest du eine kurze KI-Materialberatung — oder wählst du dein Material direkt selbst?"
                        : materialMode === "ki"
                          ? "Diskutiere mit unserer KI: stelle Fragen, vergleiche Materialien und übernimm am Ende die Empfehlung — oder wähle selbst."
                          : "Wähle dein Material direkt aus der Liste."}
                    </p>
                  </div>

                  {materialMode === null && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => { trackCalc("schritt_2_ki_chat_gestartet"); setMaterialMode("ki"); setKiChatOpen(true); }}
                        className="text-left rounded-2xl border-2 border-primary bg-primary/5 p-5 hover:bg-primary/10 transition-colors"
                      >
                        <div className="flex items-center gap-2 text-primary font-bold">
                          <Sparkles className="w-4 h-4" /> Ja, KI-Beratung
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                          Ein paar kurze Fragen zur Anwendung — wir empfehlen dir das passende Material. Dauert ca. 1 Minute.
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMaterialMode("manual")}
                        className="text-left rounded-2xl border-2 border-border bg-card p-5 hover:border-primary/40 transition-colors"
                      >
                        <div className="flex items-center gap-2 font-bold text-foreground">
                          <Check className="w-4 h-4" /> Nein, selbst wählen
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                          Ich weiss schon, was ich brauche — Material direkt aus der Liste auswählen.
                        </p>
                      </button>
                    </div>
                  )}

                  {materialMode !== null && (
                    <button
                      type="button"
                      onClick={() => { setMaterialMode(null); setKiChatOpen(true); }}
                      className="text-xs text-muted-foreground hover:text-primary underline"
                    >
                      ← Auswahl ändern (KI-Beratung / selbst wählen)
                    </button>
                  )}

                  {materialMode === "ki" && (!isMobile || kiChatOpen) && (
                    <KiMaterialChat
                      key={chatKey}
                      fileName={parts.map((p) => p.fileName).join(", ")}
                      geometry={geometryText}
                      availableMaterials={materials.map((m) => m.name)}
                      partNames={parts.map((p) => p.fileName)}
                      onResult={handleKiResult}
                      mobileFullscreen={isMobile}
                      onClose={() => setKiChatOpen(false)}
                      onAcceptRecommendation={
                        recommendedMaterial
                          ? () => {
                              chooseMaterial(recommendedMaterial.id, true);
                              setKiChatOpen(false);
                            }
                          : undefined
                      }
                      recommendedMaterialName={recommendedMaterial?.name}
                    />
                  )}

                  {isMobile && materialMode === "ki" && !kiChatOpen && (
                    <button
                      onClick={() => setKiChatOpen(true)}
                      className="w-full flex items-center justify-center gap-2 rounded-2xl border border-primary/40 bg-primary/5 text-primary font-medium py-3 text-sm mb-4"
                    >
                      <MessageCircle className="w-4 h-4" />
                      KI-Beratung wieder öffnen
                    </button>
                  )}

                  {isMobile && materialMode === "ki" && !kiChatOpen && !kiResult && (
                    <p className="text-xs text-muted-foreground text-center mb-4">
                      Kein Material empfohlen – bitte manuell wählen oder Chat öffnen
                    </p>
                  )}

                  {kiResult && (!isMobile || !kiChatOpen) && (
                    <div className="rounded-2xl border-2 border-primary bg-primary/5 p-5">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold text-primary mb-1">
                        <Sparkles className="w-3.5 h-3.5" /> Empfehlung
                      </div>
                      <p className="font-heading text-2xl font-extrabold text-primary">{kiResult.material}</p>
                      <p className="text-sm text-muted-foreground mt-2">{kiResult.begruendung}</p>
                      {recommendedMaterial && (
                        <Button
                          className="mt-4 gap-2"
                          onClick={() => chooseMaterial(recommendedMaterial.id, true)}
                          disabled={materialId === recommendedMaterial.id}
                        >
                          <Check className="w-4 h-4" />
                          {materialId === recommendedMaterial.id ? `${recommendedMaterial.name} übernommen` : `${recommendedMaterial.name} übernehmen`}
                        </Button>
                      )}
                    </div>
                  )}

                  {materialMode === "manual" && (
                    <div className="px-1 space-y-4">
                      <p className="text-sm font-semibold">Material direkt wählen</p>
                      {Object.entries(groupedMaterials).map(([typ, items]) => (
                        <div key={typ}>
                          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{typ}</p>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {items.map((m) => {
                              const sel = materialId === m.id;
                              return (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => chooseMaterial(m.id)}
                                  className={`relative text-left rounded-xl border-2 p-4 transition-all ${
                                    sel ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
                                  }`}
                                >
                                  {sel && <Check className="absolute top-2 right-2 w-4 h-4 text-primary" />}
                                  <p className="font-bold text-sm leading-tight mb-1">{m.name}</p>
                                  {m.farben.length > 0 && (
                                    <div className="flex items-center gap-1 flex-wrap">
                                      {m.farben.slice(0, 8).map((cn) => (
                                        <span
                                          key={cn}
                                          title={cn}
                                          className="w-3.5 h-3.5 rounded-full border border-border/60"
                                          style={{ backgroundColor: m.farbHex?.[cn] || colorHex(cn) }}
                                        />
                                      ))}
                                      <span className="text-[11px] text-muted-foreground ml-1">
                                        {m.farben.length} {m.farben.length === 1 ? "Farbe" : "Farben"}
                                      </span>
                                    </div>
                                  )}

                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {materialMode === "ki" && (!isMobile || !kiChatOpen) && (
                    <div className="px-1 space-y-4">
                      <p className="text-sm font-semibold">Alle Materialien</p>
                      {Object.entries(groupedMaterials).map(([typ, items]) => (
                        <div key={typ}>
                          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{typ}</p>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {items.map((m) => {
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
                                  <p className="font-bold text-sm leading-tight mb-1">{m.name}</p>
                                  {m.farben.length > 0 && (
                                    <div className="flex items-center gap-1 flex-wrap">
                                      {m.farben.slice(0, 8).map((cn) => (
                                        <span
                                          key={cn}
                                          title={cn}
                                          className="w-3.5 h-3.5 rounded-full border border-border/60"
                                          style={{ backgroundColor: m.farbHex?.[cn] || colorHex(cn) }}
                                        />
                                      ))}
                                      <span className="text-[11px] text-muted-foreground ml-1">
                                        {m.farben.length} {m.farben.length === 1 ? "Farbe" : "Farben"}
                                      </span>
                                    </div>
                                  )}

                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}


                  {materialId && (materialMode === "manual" || (materialMode === "ki" && (!isMobile || !kiChatOpen))) && (
                    <div className="fixed bottom-0 left-0 right-0 lg:relative lg:bottom-auto z-40 lg:z-auto bg-background/95 backdrop-blur-sm lg:bg-transparent lg:backdrop-blur-none border-t border-border lg:border-none p-4 lg:p-0"
                      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}>
                      <Button
                        onClick={goNext}
                        disabled={!canGoNext}
                        className="w-full lg:w-auto"
                        size="lg"
                      >
                        Weiter → {STEPS[step] || ""}
                      </Button>
                    </div>
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
                              style={{ backgroundColor: selectedMaterial?.farbHex?.[name] || colorHex(name) }}
                            />

                            <span className="text-xs font-medium text-center">{name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <Button
                    className="w-full gap-2"
                    onClick={() => { trackCalc("schritt_3_farbe_gewaehlt", { farbe: color || null }); goNext(); }}
                    disabled={availableColors.length > 0 && !color}
                  >
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

                  {/* Wert-Kommunikation vor dem Preis */}
                  <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
                    <p className="font-semibold text-foreground flex items-center gap-2 mb-3">
                      <Lightbulb className="w-4 h-4 text-primary" /> Jedes Teil wird einzeln für Sie gefertigt – Schicht für Schicht, in Schweizer Qualität.
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">⏱</span>
                        <div>
                          <p className="text-xs text-muted-foreground">Druckzeit</p>
                          <p className="font-semibold text-sm">{totalHours > 0 ? `${totalHours.toFixed(1)} Stunden` : "wird berechnet"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">🧵</span>
                        <div>
                          <p className="text-xs text-muted-foreground">Filament</p>
                          <p className="font-semibold text-sm">{totalGrams > 0 ? `${totalGrams.toFixed(0)}g` : "wird berechnet"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">🇨🇭</span>
                        <div>
                          <p className="text-xs text-muted-foreground">Standort</p>
                          <p className="font-semibold text-sm">Eschlikon TG</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">✅</span>
                        <div>
                          <p className="text-xs text-muted-foreground">Qualität</p>
                          <p className="font-semibold text-sm">Geprüft &amp; verpackt</p>
                        </div>
                      </div>
                    </div>
                  </div>



                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {qualityPresets.map((q) => {
                      const sel = qualityKey === q.key;
                      const Icon = QUALITY_ICONS[q.key] || Gauge;

                      return (
                        <button
                          key={q.key}
                          type="button"
                          onClick={() => confirmQuality(q.key, q.infill)}
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

                  <div className="fixed bottom-0 left-0 right-0 lg:relative lg:bottom-auto z-40 lg:z-auto bg-background/95 backdrop-blur-sm lg:bg-transparent lg:backdrop-blur-none border-t border-border lg:border-none p-4 lg:p-0"
                    style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}>
                    <Button
                      onClick={goNext}
                      disabled={!canGoNext}
                      className="w-full lg:w-auto"
                      size="lg"
                    >
                      {kiLoading
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> 🤖 Analyse läuft…</>
                        : <>Weiter → {STEPS[step] || ""}</>}
                    </Button>
                  </div>

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
                                ~ Geschätzter Preis – finale Prüfung durch 3DMuscio · {calc.weight.toFixed(1)} g · Stückpreis {CHF(calc.unit)}
                              </p>
                            )}

                            {p.slicerLoading && (
                              <p className="text-xs text-primary mt-1 flex items-center gap-1.5">
                                <Loader2 className="w-3 h-3 animate-spin" /> ⚙️ Slicing läuft…
                              </p>
                            )}
                            {p.slicerResult && !p.slicerLoading && (
                              <div className="mt-1 space-y-0.5">
                                <span className="inline-flex items-center gap-1 rounded-full bg-success/10 text-success text-xs px-2 py-0.5">
                                  ✓ Gesliced
                                </span>
                                <p className="text-xs text-muted-foreground">
                                  Druckzeit: {(p.slicerResult.printTimeMinutes / 60).toFixed(1)} h (OrcaSlicer) · Filament: {p.slicerResult.filamentGrams.toFixed(0)} g · Layer: {p.slicerResult.layers}
                                </p>
                                {p.slicerResult.hasSupport && (
                                  <p className="text-xs text-muted-foreground">⚠️ Support erkannt</p>
                                )}
                              </div>
                            )}
                            {p.slicerError && !p.slicerResult && (
                              <p className="text-xs text-orange-500 mt-1">~ Schätzung – {p.slicerError}</p>
                            )}

                            {p.kiAnalysisLoading && (
                              <p className="text-xs text-primary mt-1 flex items-center gap-1.5">
                                <Loader2 className="w-3 h-3 animate-spin" /> 🤖 Modell wird analysiert…
                              </p>
                            )}
                            {p.kiAnalysisError && (
                              <p className="text-xs text-muted-foreground mt-1">{p.kiAnalysisError}</p>
                            )}

                            {p.kiAnalysis && !p.kiAnalysisLoading && (
                              <div className="mt-1 space-y-0.5">
                                {p.kiAnalysis.orientierung !== "Original (Z oben)" && (
                                  <p className="text-xs text-primary">
                                    🔄 {p.kiAnalysis.orientierung} – Support {p.kiAnalysis.orientierung_original_ueberhang}% → {p.kiAnalysis.orientierung_beste_ueberhang}%
                                  </p>
                                )}
                                {p.kiAnalysis.hat_support ? (
                                  <p className="text-xs text-muted-foreground">
                                    ⚠️ Support nötig – Nachbearbeitung {CHF(p.kiAnalysis.support_nachbearbeitung)}
                                  </p>
                                ) : (
                                  <p className="text-xs text-success">✅ Kein Support nötig</p>
                                )}
                                <details className="mt-1">
                                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                    ℹ️ Wie wird der Preis berechnet?
                                  </summary>
                                  <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                                    <p>{p.kiAnalysis.begruendung}</p>
                                    <p>{p.kiAnalysis.hinweis_fuer_kunden}</p>
                                  </div>
                                </details>
                              </div>
                            )}


                            <div className="mt-2 flex items-center gap-1">
                              <button onClick={() => update(p.id, { quantity: Math.max(1, p.quantity - 1) })} aria-label="Menge verringern"
                                className="w-8 h-8 rounded-md border border-input flex items-center justify-center hover:bg-muted">
                                <Minus className="w-3 h-3" />
                              </button>
                              <Input type="number" min={1} value={p.quantity}
                                onChange={(e) => update(p.id, { quantity: Math.max(1, Number(e.target.value)) })}
                                className="h-8 w-16 text-center text-base" aria-label="Menge" />
                              <button onClick={() => update(p.id, { quantity: p.quantity + 1 })} aria-label="Menge erhöhen"
                                className="w-8 h-8 rounded-md border border-input flex items-center justify-center hover:bg-muted">
                                <Plus className="w-3 h-3" />
                              </button>
                              <span className="ml-auto text-base font-bold text-primary">
                                {isStepFile(p.fileName) ? "Auf Anfrage" : CHF(calc.subtotal)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-xs text-muted-foreground">Mengenrabatt:</span>
                              <span className={`text-xs font-semibold ${p.quantity >= 5 ? "text-primary" : "text-muted-foreground"}`}>
                                {p.quantity >= 10 ? "15% Rabatt ✓" : p.quantity >= 5 ? "10% Rabatt ✓" : "5+ Stück → 10% · 10+ Stück → 15%"}
                              </span>
                            </div>
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
                    <input id="overview-file-input" type="file" multiple accept=".stl,.3mf,.step,.obj,model/stl,model/x.stl-ascii,model/x.stl-binary,application/sla,application/vnd.ms-pki.stl,application/octet-stream,*/*" className="hidden" onChange={handleInput} />
                    <label htmlFor="overview-file-input">
                      <Button asChild variant="outline" className="gap-2 cursor-pointer w-full">
                        <span><Plus className="w-4 h-4" /> Weiteres Teil hinzufügen</span>
                      </Button>
                    </label>
                  </div>



                  {/* Preisübersicht */}
                  <div className="bg-card rounded-2xl border border-border p-5 space-y-2 text-sm">
                    {calcs.map(({ part: p, calc }) => (
                      <div key={p.id} className="space-y-1">
                        <div className="flex justify-between text-muted-foreground">
                          <span className="truncate pr-2">{p.fileName}</span>
                          <span className="text-foreground tabular-nums shrink-0">
                            {isStepFile(p.fileName) ? "Auf Anfrage" : `${CHF(calc.unit)} × ${p.quantity}`}
                          </span>
                        </div>
                        {p.kiAnalysis && !p.kiAnalysisLoading && (
                          <div className="ml-3 pl-3 border-l border-border space-y-0.5 text-xs text-muted-foreground">
                            <div className="flex justify-between"><span>Materialkosten</span><span className="tabular-nums">{CHF(p.kiAnalysis.materialkosten)}</span></div>
                            <div className="flex justify-between"><span>Maschinenzeit</span><span className="tabular-nums">{CHF(p.kiAnalysis.maschinenkosten)}</span></div>
                            {p.kiAnalysis.support_nachbearbeitung > 0 && (
                              <div className="flex justify-between"><span>Support-Nachbearbeitung</span><span className="tabular-nums">{CHF(p.kiAnalysis.support_nachbearbeitung)}</span></div>
                            )}
                            <div className="flex justify-between"><span>× {p.quantity} Stück{calc.discount > 0 ? ` (−${Math.round(calc.discount * 100)}%)` : ""}</span><span className="tabular-nums text-foreground">{CHF(calc.subtotal)}</span></div>
                          </div>
                        )}
                      </div>
                    ))}

                    <div className="border-t border-border pt-2 mt-2" />
                    <div className="flex justify-between text-muted-foreground">
                      <span>Setup-Pauschale <span className="text-xs text-muted-foreground/70">(1× pro Bestellung)</span></span>
                      <span className="text-foreground tabular-nums">{CHF(setupFee)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Versand</span>
                      <span className="text-foreground">{shipping === 0 ? "Gratis" : CHF(shipping)}</span>
                    </div>
                    <div className="border-t border-border pt-3 mt-3 flex items-center justify-between">
                      <span className="font-bold">Total</span>
                      <div className="text-right">
                        <span className="text-xl font-bold text-primary">{hasStep ? "Auf Anfrage" : CHF(total)}</span>
                        {hasStep ? (
                          <p className="text-[11px] text-muted-foreground mt-0.5">STEP-Datei – wir melden uns mit einem Angebot.</p>
                        ) : parts.some(p => p.slicerLoading) ? (
                          <p className="text-[11px] text-amber-600 mt-0.5">~ Geschätzter Preis (Analyse läuft noch…)</p>
                        ) : parts.every(p => p.slicerResult || p.slicerError) ? (
                          <p className="text-[11px] text-success mt-0.5">✓ Analysierter Preis (OrcaSlicer)</p>
                        ) : (
                          <p className="text-[11px] text-muted-foreground mt-0.5">~ Geschätzter Preis</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-success/10 border border-success/30 rounded-xl px-4 py-2.5 text-sm mt-3">
                    <span className="text-success">⚡</span>
                    <span className="text-foreground font-medium">{getDeliveryText()}</span>
                  </div>

                  {!hasStep && total > 100 && (
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      Vergleich: Spritzgussform ab CHF 5'000 · Mindestmenge 1'000 Stück · 
                      Lieferzeit 8 Wochen — bei uns ab 1 Stück, 48h.
                    </p>
                  )}

                  {!hasStep && total > 50 && (
                    <div className="rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                      💡 <strong className="text-foreground">Zum Vergleich:</strong> Eine Spritzgussform für dieses Teil würde
                      CHF 5'000–50'000 kosten – erst ab 10'000 Stück rentabel. Bei uns: ab 1 Stück, sofort.
                    </div>
                  )}

                  <div className="rounded-2xl border border-success/30 bg-success/10 p-4 text-sm">
                    <p className="font-semibold text-foreground flex items-center gap-1.5"><Package className="w-4 h-4 text-success" /> Mehr bestellen = mehr sparen</p>
                    <p className="text-muted-foreground mt-1">5+ Stück → 10% Rabatt · 10+ Stück → 15% Rabatt</p>
                  </div>


                  {/* Kontaktformular */}
                  <form onSubmit={handleSend} className="bg-card rounded-2xl border border-border p-5 space-y-4">
                    <h3 className="font-heading text-lg font-bold">Deine Kontaktdaten</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Vorname *</Label>
                        <Input required value={form.vorname} onChange={(e) => setForm((f) => ({ ...f, vorname: e.target.value }))} className="mt-1 text-base" />
                      </div>
                      <div>
                        <Label className="text-xs">Nachname *</Label>
                        <Input required value={form.nachname} onChange={(e) => setForm((f) => ({ ...f, nachname: e.target.value }))} className="mt-1 text-base" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">E-Mail *</Label>
                        <Input type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="mt-1 text-base" />
                      </div>
                      <div>
                        <Label className="text-xs">Telefon *</Label>
                        <Input type="tel" required value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="mt-1 text-base" />
                      </div>
                    </div>
                    {!isLoggedIn && (
                      <>
                        <div>
                          <Label className="text-xs">Strasse & Hausnummer *</Label>
                          <Input required value={form.strasse} onChange={(e) => setForm((f) => ({ ...f, strasse: e.target.value }))} className="mt-1 text-base" />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label className="text-xs">PLZ *</Label>
                            <Input required value={form.plz} onChange={(e) => setForm((f) => ({ ...f, plz: e.target.value }))} className="mt-1 text-base" />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">Ort *</Label>
                            <Input required value={form.ort} onChange={(e) => setForm((f) => ({ ...f, ort: e.target.value }))} className="mt-1 text-base" />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">Land</Label>
                          <Input value={form.land} onChange={(e) => setForm((f) => ({ ...f, land: e.target.value }))} className="mt-1 text-base" />
                        </div>
                      </>
                    )}
                    <div>
                      <Label className="text-xs">Nachricht (optional)</Label>
                      <Textarea rows={3} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} className="mt-1 text-base" />
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
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1.5 justify-center"><LockIcon className="w-3.5 h-3.5 text-primary" /> SSL-verschlüsselt</div>
                      <div className="flex items-center gap-1.5 justify-center">🇨🇭 Hergestellt in der Schweiz</div>
                      <div className="flex items-center gap-1.5 justify-center"><RotateCcw className="w-3.5 h-3.5 text-primary" /> Kostenlose Nachbesserung bei Druckfehler</div>
                    </div>
                  </form>

                  {calcReviews.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {calcReviews.map((r) => (
                        <div key={r.id} className="bg-card border border-border rounded-2xl p-4">
                          <div className="flex gap-0.5 mb-2">
                            {Array.from({ length: 5 }).map((_, j) => (
                              <Star key={j} className="w-3.5 h-3.5 fill-primary text-primary" />
                            ))}
                          </div>
                          <p className="text-sm text-foreground leading-relaxed">„{r.kommentar}"</p>
                          <p className="text-xs text-muted-foreground mt-2">– {r.customer_name}</p>
                        </div>
                      ))}
                    </div>
                  )}

                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

const SuccessView = ({
  inquiryId,
  onHerkunftSaved,
}: {
  inquiryId: string | null;
  onHerkunftSaved: () => void;
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="max-w-2xl mx-auto space-y-6"
    >
      <div className="bg-card border border-border rounded-3xl p-8 md:p-12 text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-5">
          <Check className="w-8 h-8 text-primary" />
        </div>
        <h1 className="font-heading text-2xl md:text-3xl font-extrabold text-foreground mb-2">
          ✓ Bestellung erhalten! Wir melden uns bald.
        </h1>
        <p className="text-muted-foreground text-sm">
          Vielen Dank für deine Anfrage. Wir prüfen deine Dateien und melden uns innerhalb von 24 Stunden bei dir.
        </p>
      </div>

      <AnimatePresence>
        {inquiryId && (
          <motion.div
            key="herkunft"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <HerkunftBanner inquiryId={inquiryId} onSaved={onHerkunftSaved} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default CalculatorOnlinePage;
