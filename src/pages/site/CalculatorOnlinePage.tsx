import { useState, useCallback, useEffect } from "react";
import { ScrollReveal } from "@/components/site/ScrollReveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Upload, Trash2, Plus, Minus, Loader2, Send, Package, ArrowRight, FileText, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import StlPreview from "@/components/site/StlPreview";
import { colorHex } from "@/lib/colorMap";

interface Material {
  id: string;
  name: string;
  pricePerGram: number;
  density: number;
  farben: string[];
}

const QUALITY_PRESETS: { key: string; label: string; infill: number; desc: string }[] = [
  { key: "schnell", label: "Schnell", infill: 15, desc: "Schnell = leicht & günstig" },
  { key: "standard", label: "Standard", infill: 20, desc: "Standard = ausgewogen" },
  { key: "stark", label: "Stark", infill: 40, desc: "Stark = belastbar" },
  { key: "massiv", label: "Massiv", infill: 80, desc: "Massiv = maximale Festigkeit" },
];

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
  manualWeightG?: number; // für non-STL
  isStl: boolean;
  previewUrl?: string;
}

const CHF = (n: number) => `CHF ${n.toFixed(2)}`;
const SHIPPING_FREE_FROM = 65;
const SHIPPING_COST = 8;
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

const CalculatorOnlinePage = () => {
  const [parts, setParts] = useState<Part[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(true);
  const [materialsError, setMaterialsError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showQuote, setShowQuote] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });

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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setIsLoggedIn(true);
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("user_id", user.id)
        .maybeSingle();
      setForm((f) => ({
        ...f,
        name: profile?.full_name || user.user_metadata?.full_name || "",
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
    const isStl = /\.stl$/i.test(file.name);
    const previewUrl = isStl ? URL.createObjectURL(file) : undefined;

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
        manualWeightG: isStl ? undefined : undefined,
        isStl,
        previewUrl,
      },
    ]);

    // STL volume berechnen
    if (isStl) {
      try {
        const vol = await calcStlVolumeCm3(file);
        setParts((p) => p.map((x) => (x.id === id ? { ...x, volumeCm3: vol } : x)));
      } catch (err) {
        console.warn("Volumen-Berechnung fehlgeschlagen", err);
      }
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
    setParts((p) => p.map((x) => {
      if (x.id !== id) return x;
      const next = { ...x, ...u };
      // Wenn Material gewechselt wurde: Farbe ggf. auf erste verfügbare Farbe setzen
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
  const remove = (id: string) => setParts((p) => {
    const target = p.find((x) => x.id === id);
    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
    return p.filter((x) => x.id !== id);
  });

  const calcPart = (p: Part) => {
    const mat = materials.find((m) => m.id === p.materialId);
    if (!mat) return { weight: 0, unit: 0, subtotal: 0, discount: 0 };
    const shellRatio = 0.25;
    const infillRatio = p.infill / 100;
    const fillFactor = shellRatio + (1 - shellRatio) * infillRatio;
    let weight = 0;
    if (p.isStl && p.volumeCm3 > 0) {
      weight = p.volumeCm3 * mat.density * fillFactor;
    } else if (p.manualWeightG && p.manualWeightG > 0) {
      weight = p.manualWeightG * fillFactor;
    }
    const matCost = weight * mat.pricePerGram;
    const unit = matCost; // Setup-Gebühr separat unten
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

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const summary = parts
        .map((p) => `${p.fileName} (${p.quantity}× ${(materials.find(m=>m.id===p.materialId)?.name || p.materialId)}, ${p.color}, ${p.infill}% Infill)`)
        .join("; ");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      let customer_id: string | null = null;
      let resolvedName = form.name;
      let resolvedEmail = form.email;
      let resolvedPhone = form.phone;
      if (user) {
        const { data: cust } = await supabase.from("customers").select("id, name, vorname, telefon").eq("auth_user_id", user.id).maybeSingle();
        customer_id = cust?.id ?? null;
        if (!resolvedEmail) resolvedEmail = user.email || "";
        if (!resolvedName) {
          const fromCust = cust ? `${cust.vorname || ""} ${cust.name || ""}`.trim() : "";
          resolvedName = fromCust || (user.user_metadata?.full_name as string) || user.email || "Kunde";
        }
        if (!resolvedPhone) resolvedPhone = (cust?.telefon as string) || "";
      }
      const attachments = parts
        .filter((p) => p.storagePath)
        .map((p) => ({
          filename: p.fileName,
          storage_path: p.storagePath,
          size_bytes: p.file?.size ?? null,
          bucket: "project-uploads",
        }));
      const { error } = await supabase.from("inquiries").insert({
        name: resolvedName,
        email: resolvedEmail,
        telefon: resolvedPhone || null,
        betreff: "Preisanfrage Kalkulator",
        nachricht: `${summary}\n\nGeschätzter Gesamtpreis: ${CHF(total)}\n\nNachricht: ${form.message}`,
        status: "Neu",
        quelle: "kalkulator",
        customer_id,
        attachments,
      } as any);
      if (error) throw error;
      toast.success("Anfrage gesendet! Wir melden uns innerhalb 24h.");
      setShowQuote(false);
      setForm({ name: "", email: "", phone: "", message: "" });
      setParts([]);
    } catch (err) {
      console.error(err);
      toast.error("Fehler beim Senden — bitte später erneut versuchen.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <TooltipProvider delayDuration={150}>
    <div className="pt-12 pb-20">
      <div className="container mx-auto px-4 max-w-6xl">
        <ScrollReveal>
          <div className="text-center mb-10">
            <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">Online-Kalkulator</p>
            <h1 className="font-heading text-4xl md:text-5xl font-extrabold text-foreground mb-4">
              Preis sofort berechnen
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Lade deine 3D-Modelle hoch (STL, 3MF, STEP, OBJ) und erhalte eine sofortige Preisschätzung.
            </p>
          </div>
        </ScrollReveal>

        {materialsLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : materialsError ? (
          <div className="text-center py-20 text-destructive">{materialsError}</div>
        ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Upload + parts */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-border bg-primary/5 p-4 flex items-start gap-3">
              <Layers className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div>
                <Badge className="mb-1">Mehrere Teile möglich</Badge>
                <p className="text-sm text-muted-foreground">
                  Lade mehrere STL-Dateien hoch — jedes Teil wird separat konfiguriert und kalkuliert.
                </p>
              </div>
            </div>

            <div
              onDrop={handleDrop}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all ${
                dragOver ? "border-primary bg-primary/5" : "border-border bg-card"
              }`}
            >
              <input
                id="file-input"
                type="file"
                multiple
                accept=".stl,.3mf,.step,.obj"
                className="hidden"
                onChange={handleInput}
              />
              <Upload className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="font-heading text-xl font-bold text-foreground mb-2">Dateien hierher ziehen</h3>
              <p className="text-sm text-muted-foreground mb-4">STL, 3MF, STEP, OBJ — bis 500MB pro Datei</p>
              <label htmlFor="file-input">
                <Button asChild className="gap-2 cursor-pointer">
                  <span>
                    <Upload className="w-4 h-4" /> Dateien auswählen
                  </span>
                </Button>
              </label>
            </div>

            {parts.length > 0 && (
              <div className="space-y-3">
                {calcs.map(({ part: p, calc }) => (
                  <div key={p.id} className="bg-card rounded-2xl border border-border p-5">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex items-start gap-4 min-w-0 flex-1">
                        {p.isStl && p.previewUrl ? (
                          <div className="w-[150px] h-[150px] rounded-xl bg-muted overflow-hidden shrink-0">
                            <StlPreview url={p.previewUrl} />
                          </div>
                        ) : (
                          <div className="w-[150px] h-[150px] rounded-xl bg-muted flex items-center justify-center shrink-0">
                            <FileText className="w-12 h-12 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{p.fileName}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {p.isStl && p.volumeCm3 > 0
                              ? <>Volumen: {p.volumeCm3.toFixed(1)} cm³ · Gewicht: ~{calc.weight.toFixed(1)}g</>
                              : !p.isStl && p.manualWeightG
                                ? <>Gewicht: ~{calc.weight.toFixed(1)}g</>
                                : p.isStl
                                  ? <>Volumen wird berechnet…</>
                                  : <>Bitte Gewicht eintragen</>}
                            {p.uploading && <span className="ml-2 text-primary">· Datei wird hochgeladen…</span>}
                            {!p.uploading && p.storagePath && <span className="ml-2 text-success">· Datei bereit</span>}
                            {!p.uploading && !p.storagePath && (
                              <span className="ml-2 text-warning">· Datei nicht hochgeladen</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <button onClick={() => remove(p.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Material</Label>
                        <select
                          value={p.materialId}
                          onChange={(e) => update(p.id, { materialId: e.target.value })}
                          className="mt-1 w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                        >
                          {materials.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label className="text-xs">Menge</Label>
                        <div className="mt-1 flex items-center gap-1">
                          <button
                            onClick={() => update(p.id, { quantity: Math.max(1, p.quantity - 1) })}
                            className="w-9 h-9 rounded-md border border-input flex items-center justify-center hover:bg-muted"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <Input
                            type="number"
                            min={1}
                            value={p.quantity}
                            onChange={(e) => update(p.id, { quantity: Math.max(1, Number(e.target.value)) })}
                            className="h-9 text-center"
                          />
                          <button
                            onClick={() => update(p.id, { quantity: p.quantity + 1 })}
                            className="w-9 h-9 rounded-md border border-input flex items-center justify-center hover:bg-muted"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Farbauswahl als Punkte */}
                    <div className="mt-4">
                      <Label className="text-xs">Farbe</Label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {COLORS.map((c) => {
                          const selected = p.color === c.name;
                          return (
                            <Tooltip key={c.name}>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={() => update(p.id, { color: c.name })}
                                  className={`w-7 h-7 rounded-full border-2 transition-all ${selected ? "border-primary ring-2 ring-primary/30 scale-110" : "border-border hover:border-foreground/40"}`}
                                  style={{ backgroundColor: c.hex }}
                                  aria-label={c.name}
                                />
                              </TooltipTrigger>
                              <TooltipContent>{c.name}</TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                    </div>

                    {/* Qualitätsstufen */}
                    <div className="mt-4">
                      <Label className="text-xs">Qualität / Festigkeit</Label>
                      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {QUALITY_PRESETS.map((q) => {
                          const selected = p.infill === q.infill;
                          return (
                            <Tooltip key={q.key}>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={() => update(p.id, { infill: q.infill })}
                                  className={`h-9 rounded-md border text-sm font-medium transition-all ${selected ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-muted"}`}
                                >
                                  {q.label}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>{q.desc}</TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                    </div>

                    {/* Manuelles Gewicht für non-STL */}
                    {!p.isStl && (
                      <div className="mt-4">
                        <Label className="text-xs">Gewicht</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.1"
                          value={p.manualWeightG ?? ""}
                          onChange={(e) => update(p.id, { manualWeightG: e.target.value === "" ? undefined : Math.max(0, Number(e.target.value)) })}
                          placeholder="Gewicht in Gramm (aus Slicer)"
                          className="mt-1"
                        />
                      </div>
                    )}

                    {/* Mengenrabatt-Hinweis */}
                    {p.quantity >= 4 && p.quantity < 5 && (
                      <p className="mt-3 text-xs text-success font-medium">Ab 5 Stück: 10% Rabatt</p>
                    )}
                    {p.quantity >= 5 && p.quantity < 10 && (
                      <p className="mt-3 text-xs text-success font-medium">10% Rabatt aktiv · Ab 10 Stück: 15% Rabatt</p>
                    )}
                    {p.quantity >= 10 && (
                      <p className="mt-3 text-xs text-success font-medium">15% Mengenrabatt aktiv</p>
                    )}

                    <div className="mt-4 flex items-center justify-between pt-3 border-t border-border">
                      <span className="text-xs text-muted-foreground">
                        Stückpreis: {CHF(calc.unit)}
                        {calc.discount > 0 && ` · ${calc.discount * 100}% Rabatt`}
                      </span>
                      <span className="text-lg font-bold text-primary">{CHF(calc.subtotal)}</span>
                    </div>
                  </div>
                ))}
                <label htmlFor="file-input" className="block">
                  <div className="rounded-2xl border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all p-4 flex items-center justify-center gap-2 cursor-pointer text-sm text-muted-foreground">
                    <Plus className="w-4 h-4" /> Weitere Datei hinzufügen
                  </div>
                </label>
              </div>
            )}
          </div>

          {/* Right: Summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 bg-card rounded-2xl border border-border p-6">
              <h3 className="font-heading text-lg font-bold mb-4">Zusammenfassung</h3>
              <div className="space-y-2 text-sm">
                {calcs.length > 0 && (
                  <div className="space-y-1.5 pb-3 mb-1 border-b border-border">
                    {calcs.map(({ part, calc }, i) => (
                      <div key={part.id} className="flex justify-between gap-2 text-xs text-muted-foreground">
                        <span className="truncate">Teil {i + 1}: {part.fileName} ({part.quantity}×)</span>
                        <span className="text-foreground shrink-0">{CHF(calc.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground">
                  <span>Materialkosten</span>
                  <span className="text-foreground">{CHF(materialTotal)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Setup-Gebühr</span>
                  <span className="text-foreground">{CHF(setupFee)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Versand</span>
                  <span className="text-foreground">{shipping === 0 ? "Gratis" : CHF(shipping)}</span>
                </div>
                <div className="border-t border-border pt-3 mt-3 flex items-center justify-between">
                  <span className="font-bold">Total</span>
                  <span className="text-xl font-bold text-primary">{CHF(total)}</span>
                </div>
              </div>
              <Button
                className="w-full mt-5 gap-2"
                disabled={parts.length === 0 || submitting || parts.some((p) => p.uploading)}
                onClick={async (e) => {
                  if (isLoggedIn) {
                    await handleSend(e as unknown as React.FormEvent);
                  } else {
                    setShowQuote(true);
                  }
                }}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Wird gesendet...
                  </>
                ) : (
                  <>
                    Angebot anfragen <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground mt-3 text-center">
                Preise sind Schätzungen. Verbindliches Angebot innerhalb 24h.
              </p>
            </div>
          </div>
        </div>
        )}

        <Dialog open={showQuote} onOpenChange={setShowQuote}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Angebot anfragen</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSend} className="space-y-4">
              <div>
                <Label className="text-xs">Name *</Label>
                <Input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">E-Mail *</Label>
                <Input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Telefon (optional)</Label>
                <Input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Nachricht (optional)</Label>
                <Textarea
                  rows={3}
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <Button type="submit" className="w-full gap-2" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Wird gesendet...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Anfrage senden
                  </>
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
    </TooltipProvider>
  );
};

export default CalculatorOnlinePage;
