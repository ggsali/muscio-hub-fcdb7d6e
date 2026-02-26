import { useState, useCallback } from "react";
import { ScrollReveal } from "@/components/ScrollReveal";
import { Button } from "@/components/ui/button";
import { calculatorMaterials } from "@/data/materials";
import {
  Upload, FileCheck, Minus, Plus, Check, Loader2, X,
  Trash2, Pencil, Copy, ArrowRight, Package, FileDown, Send,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const HUB_ENDPOINT = "https://ukqtjdsjmtxgzhklvqky.supabase.co/functions/v1/submit-inquiry";

const pricing = {
  materials: {} as Record<string, number>,
  printTimeCostPerHour: 3.0,
  postProcessingFee: 2.0,
  bulkDiscount5: 0.10,
  bulkDiscount10: 0.15,
  shippingCost: 8.0,
  freeShippingThreshold: 65,
  mwst: 0.081,
};

const colorOptions = [
  { name: "Weiss", hex: "#FAFAFA" }, { name: "Schwarz", hex: "#1a1a1a" },
  { name: "Grau", hex: "#9E9E9E" }, { name: "Rot", hex: "#F44336" },
  { name: "Blau", hex: "#2196F3" }, { name: "Grün", hex: "#4CAF50" },
  { name: "Gelb", hex: "#FFEB3B" }, { name: "Orange", hex: "#FF9800" },
  { name: "Transparent", hex: "#E0E0E0" }, { name: "Wood-Fill", hex: "#A1887F" },
];

const layerOptions = [
  { label: "Draft", value: "0.3mm", desc: "schnell", speed: 0.6 },
  { label: "Standard", value: "0.2mm", desc: "empfohlen", badge: true, speed: 1.0 },
  { label: "Fein", value: "0.1mm", desc: "detail", speed: 2.0 },
];

const generateFakeModel = () => {
  const vol = +(15 + Math.random() * 80).toFixed(1);
  const a = Math.round(30 + Math.random() * 80);
  const b = Math.round(20 + Math.random() * 60);
  const c = Math.round(15 + Math.random() * 50);
  return { baseVolume: vol, dimensions: `${a} × ${b} × ${c}mm` };
};

const calcVolumeAndWeight = (baseVolume: number, infill: number, density: number) => {
  const shellFraction = 0.08;
  const infillFraction = (1 - shellFraction) * (infill / 100);
  const effectiveFraction = shellFraction + infillFraction;
  const volume = +(baseVolume * effectiveFraction).toFixed(1);
  const weight = Math.round(volume * density);
  return { volume, weight };
};

interface Part {
  id: string; fileName: string; materialId: string; layerHeight: string;
  infill: number; color: string; quantity: number; volume: number;
  weight: number; dimensions: string; baseVolume: number;
}

const createPart = (fileName: string): Part => {
  const model = generateFakeModel();
  const mat = calculatorMaterials.find(m => m.id === "pla")!;
  const { volume, weight } = calcVolumeAndWeight(model.baseVolume, 20, mat.density);
  return { id: crypto.randomUUID(), fileName, materialId: "pla", layerHeight: "0.2mm", infill: 20, color: "Weiss", quantity: 1, baseVolume: model.baseVolume, dimensions: model.dimensions, volume, weight };
};

const WebsiteKalkulator = () => {
  const [parts, setParts] = useState<Part[]>([]);
  const [editingPartId, setEditingPartId] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showQuote, setShowQuote] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [quoteForm, setQuoteForm] = useState({ name: "", email: "", phone: "", message: "" });

  const handleUpload = useCallback((name: string) => {
    setAnalyzing(true);
    setTimeout(() => {
      const newPart = createPart(name);
      setParts(prev => [...prev, newPart]);
      setEditingPartId(newPart.id);
      setAnalyzing(false);
    }, 1500);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0]; if (f) handleUpload(f.name);
  }, [handleUpload]);

  const updatePart = (id: string, updates: Partial<Part>) => {
    setParts(prev => prev.map(p => {
      if (p.id !== id) return p;
      const merged = { ...p, ...updates };
      if ("infill" in updates || "materialId" in updates) {
        const mat = calculatorMaterials.find(m => m.id === merged.materialId)!;
        const { volume, weight } = calcVolumeAndWeight(merged.baseVolume, merged.infill, mat.density);
        return { ...merged, volume, weight };
      }
      return merged;
    }));
  };

  const removePart = (id: string) => {
    setParts(prev => prev.filter(p => p.id !== id));
    if (editingPartId === id) setEditingPartId(null);
    toast.success("Teil entfernt");
  };

  const duplicatePart = (id: string) => {
    const original = parts.find(p => p.id === id);
    if (!original) return;
    setParts(prev => [...prev, { ...original, id: crypto.randomUUID(), fileName: original.fileName + " (Kopie)" }]);
    toast.success("Teil dupliziert");
  };

  const calcPart = (p: Part) => {
    const mat = calculatorMaterials.find(m => m.id === p.materialId)!;
    const layer = layerOptions.find(l => l.value === p.layerHeight)!;
    const ppg = pricing.materials[p.materialId] || mat.pricePerGram;
    const materialCost = p.weight * ppg;
    const printHours = (p.weight / mat.density / 10) * layer.speed;
    const printTimeCost = printHours * pricing.printTimeCostPerHour;
    const postProcessing = pricing.postProcessingFee;
    const unitCost = materialCost + printTimeCost + postProcessing;
    let bulkDiscount = 0;
    if (p.quantity >= 10) bulkDiscount = pricing.bulkDiscount10;
    else if (p.quantity >= 5) bulkDiscount = pricing.bulkDiscount5;
    const subtotal = unitCost * p.quantity * (1 - bulkDiscount);
    return { materialCost, printHours, printTimeCost, postProcessing, unitCost, bulkDiscount, subtotal, printHoursTotal: printHours * p.quantity };
  };

  const partCalcs = parts.map(p => ({ part: p, calc: calcPart(p) }));
  const totalSubtotal = partCalcs.reduce((s, { calc }) => s + calc.subtotal, 0);
  const totalPrintHours = partCalcs.reduce((s, { calc }) => s + calc.printHoursTotal, 0);
  const totalItems = parts.reduce((s, p) => s + p.quantity, 0);
  const shipping = totalSubtotal >= pricing.freeShippingThreshold ? 0 : pricing.shippingCost;
  const mwst = (totalSubtotal + shipping) * pricing.mwst;
  const total = totalSubtotal + shipping + mwst;

  const deliveryDays = Math.max(1, 2 + Math.floor(totalPrintHours / 8) + Math.floor(totalItems / 5));
  const deliveryDate = new Date();
  let daysAdded = 0;
  while (daysAdded < deliveryDays) {
    deliveryDate.setDate(deliveryDate.getDate() + 1);
    if (deliveryDate.getDay() !== 0 && deliveryDate.getDay() !== 6) daysAdded++;
  }
  const deliveryDateStr = deliveryDate.toLocaleDateString("de-CH", { weekday: "long", day: "numeric", month: "long" });

  const chf = (n: number) => `CHF ${n.toFixed(2)}`;

  const handleQuoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(HUB_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: quoteForm.name,
          email: quoteForm.email,
          telefon: quoteForm.phone || null,
          betreff: "Angebot",
          nachricht: `Kalkulator-Anfrage:\n${parts.map(p => `- ${p.fileName} (${p.materialId.toUpperCase()}, ${p.quantity}x, ${p.layerHeight})`).join("\n")}\n\nTotal: ${chf(total)}\nLieferung: ${deliveryDateStr}\n\n${quoteForm.message}`,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Angebot angefordert! Wir melden uns innerhalb 24h.");
      setShowQuote(false);
      setQuoteForm({ name: "", email: "", phone: "", message: "" });
    } catch {
      toast.error("Fehler beim Senden. Bitte schreib uns direkt an info@3dmuscio.ch");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pt-24 pb-16 bg-[#0a0a0a] min-h-screen">
      <div className="container mx-auto px-4">
        <ScrollReveal>
          <div className="text-center mb-10">
            <p className="text-xs font-medium text-[#00cc66] uppercase tracking-widest mb-3">Kalkulator</p>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mb-3">Sofort-Kalkulator</h1>
            <p className="text-white/50 text-sm max-w-md mx-auto">Lade ein oder mehrere 3D-Modelle hoch und erhalte sofort deinen Preis.</p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          <div className="lg:col-span-2 space-y-6">
            {/* Upload */}
            <div className="bg-[#111] rounded-xl border border-white/8 p-6">
              <h2 className="text-sm font-bold text-white mb-1">Modell hochladen</h2>
              <p className="text-white/40 text-xs mb-4">STL, OBJ, STEP oder 3MF — bis 500MB</p>
              <label
                className={`rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer border-2 border-dashed transition-all ${dragOver ? "border-[#00cc66] bg-[#00cc66]/5" : "border-white/10 hover:border-[#00cc66]/50"}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                {analyzing ? (
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-[#00cc66] animate-spin" />
                    <span className="text-sm text-white/50">Analysiere Modell...</span>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-white/20 mb-3" />
                    <p className="font-semibold text-white text-sm mb-1">Datei hierher ziehen</p>
                    <p className="text-white/30 text-xs mb-3">oder klicken zum Auswählen</p>
                    <div className="flex gap-2">
                      {["STL", "OBJ", "STEP", "3MF"].map(fmt => (
                        <span key={fmt} className="text-[10px] px-2 py-0.5 bg-white/5 rounded text-white/40 font-medium">{fmt}</span>
                      ))}
                    </div>
                  </>
                )}
                <input type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f.name); }} accept=".stl,.obj,.step,.3mf" />
              </label>
            </div>

            {/* Parts list */}
            <AnimatePresence>
              {parts.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                  <h2 className="text-sm font-bold text-white">Deine Teile ({parts.length})</h2>
                  {parts.map(p => {
                    const pc = calcPart(p);
                    const isEditing = editingPartId === p.id;
                    const mat = calculatorMaterials.find(m => m.id === p.materialId)!;
                    return (
                      <motion.div key={p.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
                        className={`bg-[#111] rounded-xl border transition-colors ${isEditing ? "border-[#00cc66]/50" : "border-white/8"}`}>
                        <div className="flex items-center justify-between p-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-[#00cc66]/10 flex items-center justify-center flex-shrink-0">
                              <FileCheck className="w-4 h-4 text-[#00cc66]" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-sm text-white truncate">{p.fileName}</p>
                              <p className="text-xs text-white/40">{mat.name} · {p.layerHeight} · {p.quantity}× · {chf(pc.subtotal)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button onClick={() => setEditingPartId(isEditing ? null : p.id)}
                              className={`p-2 rounded-lg transition-colors ${isEditing ? "bg-[#00cc66]/10 text-[#00cc66]" : "hover:bg-white/5 text-white/40"}`}>
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => duplicatePart(p.id)} className="p-2 rounded-lg hover:bg-white/5 text-white/40"><Copy className="w-4 h-4" /></button>
                            <button onClick={() => removePart(p.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </div>
                        <AnimatePresence>
                          {isEditing && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                              <div className="px-4 pb-5 pt-2 border-t border-white/5 space-y-6">
                                <div className="flex gap-4 text-xs text-white/30 bg-white/5 rounded-lg p-3">
                                  <span>Vol: {p.volume}cm³</span><span>{p.dimensions}</span><span>~{p.weight}g</span>
                                </div>
                                {/* Material */}
                                <div>
                                  <h3 className="font-semibold text-white text-sm mb-2">Material</h3>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {calculatorMaterials.map(m => (
                                      <button key={m.id} onClick={() => updatePart(p.id, { materialId: m.id })}
                                        className={`text-left p-3 rounded-lg border transition-all text-xs ${p.materialId === m.id ? "border-[#00cc66]/50 bg-[#00cc66]/5" : "border-white/8 hover:border-white/20"}`}>
                                        <div className="flex items-center gap-2 mb-1">
                                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: m.color }} />
                                          <span className="font-bold text-white">{m.name}</span>
                                        </div>
                                        <span className="text-[#00cc66] font-semibold">CHF {m.pricePerGram.toFixed(2)}/g</span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                {/* Layer */}
                                <div>
                                  <h3 className="font-semibold text-white text-sm mb-2">Schichthöhe</h3>
                                  <div className="flex gap-2">
                                    {layerOptions.map(l => (
                                      <button key={l.value} onClick={() => updatePart(p.id, { layerHeight: l.value })}
                                        className={`flex-1 p-3 rounded-lg border text-center transition-all relative text-xs ${p.layerHeight === l.value ? "border-[#00cc66]/50 bg-[#00cc66]/5" : "border-white/8 hover:border-white/20"}`}>
                                        {l.badge && <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] font-bold px-2 py-0.5 bg-[#00cc66] text-black rounded-full">empfohlen</span>}
                                        <span className="font-bold text-white block">{l.label}</span>
                                        <span className="text-white/40">{l.value}</span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                {/* Infill */}
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <h3 className="font-semibold text-white text-sm">Fülldichte</h3>
                                    <span className="text-xs font-medium text-[#00cc66]">{p.infill}%</span>
                                  </div>
                                  <input type="range" min={10} max={100} step={5} value={p.infill}
                                    onChange={e => updatePart(p.id, { infill: Number(e.target.value) })}
                                    className="w-full accent-[#00cc66]" />
                                  <div className="flex justify-between text-[10px] text-white/30 mt-1">
                                    <span>10% – Leicht</span><span>50% – Mittel</span><span>100% – Massiv</span>
                                  </div>
                                </div>
                                {/* Color */}
                                <div>
                                  <h3 className="font-semibold text-white text-sm mb-2">Farbe: {p.color}</h3>
                                  <div className="flex flex-wrap gap-1.5">
                                    {colorOptions.map(c => (
                                      <button key={c.name} onClick={() => updatePart(p.id, { color: c.name })}
                                        className={`w-8 h-8 rounded-lg border-2 transition-all relative ${p.color === c.name ? "border-[#00cc66] scale-110" : "border-white/10 hover:border-white/30"}`}
                                        style={{ backgroundColor: c.hex }} title={c.name}>
                                        {p.color === c.name && <Check className="w-3 h-3 absolute inset-0 m-auto text-black" />}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                {/* Qty */}
                                <div>
                                  <h3 className="font-semibold text-white text-sm mb-2">Stückzahl</h3>
                                  <div className="flex items-center gap-3">
                                    <div className="flex items-center border border-white/10 rounded-lg">
                                      <button className="p-2 hover:bg-white/5 transition-colors rounded-l-lg text-white" onClick={() => updatePart(p.id, { quantity: Math.max(1, p.quantity - 1) })}><Minus className="w-4 h-4" /></button>
                                      <span className="w-12 text-center font-bold text-sm text-white">{p.quantity}</span>
                                      <button className="p-2 hover:bg-white/5 transition-colors rounded-r-lg text-white" onClick={() => updatePart(p.id, { quantity: Math.min(100, p.quantity + 1) })}><Plus className="w-4 h-4" /></button>
                                    </div>
                                    {p.quantity >= 5 && <span className="text-xs font-semibold text-[#00cc66] px-2 py-1 bg-[#00cc66]/10 rounded-full">-{pc.bulkDiscount * 100}% Rabatt</span>}
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Price sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 bg-[#111] rounded-xl border border-white/8 p-6">
              <h2 className="text-sm font-bold text-white mb-4">Kostenübersicht</h2>
              {parts.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="w-8 h-8 text-white/10 mx-auto mb-3" />
                  <p className="text-white/30 text-sm">Lade ein Modell hoch, um den Preis zu berechnen.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {partCalcs.map(({ part: p, calc }) => (
                    <div key={p.id} className="text-xs">
                      <div className="flex justify-between font-medium text-white mb-1">
                        <span className="truncate mr-2">{p.fileName}</span>
                        <span>{chf(calc.subtotal)}</span>
                      </div>
                      <div className="text-white/30 pl-2 space-y-0.5">
                        <div className="flex justify-between"><span>Material ({p.quantity}×)</span><span>{chf(calc.materialCost * p.quantity)}</span></div>
                        <div className="flex justify-between"><span>Druckzeit</span><span>{chf(calc.printTimeCost * p.quantity)}</span></div>
                        {calc.bulkDiscount > 0 && <div className="flex justify-between text-[#00cc66]"><span>Mengenrabatt</span><span>-{(calc.bulkDiscount * 100).toFixed(0)}%</span></div>}
                      </div>
                    </div>
                  ))}
                  <hr className="border-white/8" />
                  <div className="flex justify-between text-xs"><span className="text-white/40">Versand</span><span className="text-white">{shipping === 0 ? "Gratis ✓" : chf(shipping)}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-white/40">MwSt. (8.1%)</span><span className="text-white">{chf(mwst)}</span></div>
                  <hr className="border-white/8" />
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold text-white text-sm">Total</span>
                    <span className="text-xl font-extrabold text-[#00cc66]">{chf(total)}</span>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 space-y-1 text-xs text-white/40">
                    <div className="flex justify-between"><span>Teile</span><span className="text-white">{parts.length} Modelle · {totalItems} Stück</span></div>
                    <div className="flex justify-between"><span>Druckzeit</span><span className="text-white">ca. {totalPrintHours.toFixed(1)}h</span></div>
                    <div className="flex justify-between"><span>Lieferung</span><span className="text-white">~{deliveryDays} Werktage</span></div>
                  </div>
                  <Button className="w-full bg-[#00cc66] hover:bg-[#00aa55] text-black font-semibold gap-2" onClick={() => setShowQuote(true)}>
                    Angebot anfordern <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={showQuote} onOpenChange={setShowQuote}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Angebot anfordern</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2 mb-2">Wir senden dir innerhalb von 24h eine Bestätigung.</p>
          <form className="space-y-4" onSubmit={handleQuoteSubmit}>
            <div><Label className="text-xs">Name *</Label><Input placeholder="Dein Name" required className="mt-1" value={quoteForm.name} onChange={e => setQuoteForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label className="text-xs">E-Mail *</Label><Input type="email" placeholder="name@beispiel.ch" required className="mt-1" value={quoteForm.email} onChange={e => setQuoteForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div><Label className="text-xs">Telefon (optional)</Label><Input type="tel" placeholder="+41 79..." className="mt-1" value={quoteForm.phone} onChange={e => setQuoteForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div><Label className="text-xs">Nachricht</Label><Textarea placeholder="Besondere Anforderungen..." rows={3} className="mt-1" value={quoteForm.message} onChange={e => setQuoteForm(f => ({ ...f, message: e.target.value }))} /></div>
            <div className="bg-muted rounded-lg p-3 text-xs space-y-1">
              <div className="flex justify-between font-medium"><span>{parts.length} Teile · {totalItems} Stück</span><span className="text-[#00cc66] font-bold">{chf(total)}</span></div>
              <div className="text-muted-foreground">Lieferung: {deliveryDateStr}</div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="agb" required />
              <Label htmlFor="agb" className="text-xs text-muted-foreground cursor-pointer">Ich akzeptiere die AGB und Datenschutzerklärung</Label>
            </div>
            <Button type="submit" className="w-full bg-[#00cc66] hover:bg-[#00aa55] text-black font-semibold gap-2" disabled={submitting}>
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Wird gesendet...</> : <><Send className="w-4 h-4" /> Angebot anfordern</>}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WebsiteKalkulator;
