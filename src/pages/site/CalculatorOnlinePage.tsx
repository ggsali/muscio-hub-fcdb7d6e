import { useState, useCallback, useEffect } from "react";
import { ScrollReveal } from "@/components/site/ScrollReveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Upload, Trash2, Plus, Minus, Loader2, Send, Package, ArrowRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Material {
  id: string;
  name: string;
  pricePerGram: number;
  density: number;
}
const MATERIALS: Material[] = [
  { id: "pla", name: "PLA", pricePerGram: 0.08, density: 1.24 },
  { id: "petg", name: "PETG", pricePerGram: 0.10, density: 1.27 },
  { id: "abs", name: "ABS", pricePerGram: 0.11, density: 1.04 },
  { id: "tpu", name: "TPU (flexibel)", pricePerGram: 0.18, density: 1.21 },
  { id: "resin", name: "Resin (SLA)", pricePerGram: 0.25, density: 1.10 },
];
const COLORS = ["Weiss", "Schwarz", "Grau", "Rot", "Blau", "Grün", "Gelb", "Orange"];

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
  estimatedWeight: number;
}

const CHF = (n: number) => `CHF ${n.toFixed(2)}`;
const SHIPPING_FREE_FROM = 65;
const SHIPPING_COST = 8;

const CalculatorOnlinePage = () => {
  const [parts, setParts] = useState<Part[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [showQuote, setShowQuote] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setIsLoggedIn(true);
      const { data: profile } = await supabase
        .from("profiles").select("full_name, phone").eq("user_id", user.id).maybeSingle();
      setForm(f => ({
        ...f,
        name: profile?.full_name || user.user_metadata?.full_name || "",
        email: user.email || "",
        phone: profile?.phone || user.user_metadata?.phone || "",
      }));
    })();
  }, []);

  const addFile = useCallback(async (file: File) => {
    const estW = Math.max(8, Math.min(180, Math.round(file.size / 8000)));
    const id = crypto.randomUUID();
    setParts(p => [...p, {
      id,
      fileName: file.name,
      file,
      uploading: true,
      materialId: "pla",
      color: "Weiss",
      infill: 20,
      quantity: 1,
      estimatedWeight: estW,
    }]);
    // Upload im Hintergrund
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `kalkulator/${id}-${safeName}`;
      const { error } = await supabase.storage.from("project-uploads").upload(path, file, { upsert: false });
      if (error) throw error;
      setParts(p => p.map(x => x.id === id ? { ...x, storagePath: path, uploading: false } : x));
    } catch (err) {
      console.error("Upload-Fehler", err);
      setParts(p => p.map(x => x.id === id ? { ...x, uploading: false } : x));
      toast.error(`Upload von ${file.name} fehlgeschlagen — wir bitten dich, die Datei per Mail zu schicken.`);
    }
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    Array.from(e.dataTransfer.files).forEach(addFile);
  };
  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files || []).forEach(addFile);
    e.target.value = "";
  };

  const update = (id: string, u: Partial<Part>) =>
    setParts(p => p.map(x => x.id === id ? { ...x, ...u } : x));
  const remove = (id: string) => setParts(p => p.filter(x => x.id !== id));

  const calcPart = (p: Part) => {
    const mat = MATERIALS.find(m => m.id === p.materialId)!;
    const weight = p.estimatedWeight * (0.4 + p.infill / 100 * 0.6);
    const matCost = weight * mat.pricePerGram;
    const setupCost = 5;
    const unit = matCost + setupCost;
    let discount = 0;
    if (p.quantity >= 10) discount = 0.15;
    else if (p.quantity >= 5) discount = 0.10;
    return { weight, unit, subtotal: unit * p.quantity * (1 - discount), discount };
  };

  const calcs = parts.map(p => ({ part: p, calc: calcPart(p) }));
  const subtotal = calcs.reduce((s, { calc }) => s + calc.subtotal, 0);
  const shipping = subtotal === 0 ? 0 : (subtotal >= SHIPPING_FREE_FROM ? 0 : SHIPPING_COST);
  const total = subtotal + shipping;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const summary = parts.map(p => `${p.fileName} (${p.quantity}× ${p.materialId.toUpperCase()}, ${p.color}, ${p.infill}% Infill)`).join("; ");
      const { data: { user } } = await supabase.auth.getUser();
      let customer_id: string | null = null;
      if (user) {
        const { data: cust } = await supabase
          .from("customers").select("id").eq("auth_user_id", user.id).maybeSingle();
        customer_id = cust?.id ?? null;
      }
      const attachments = parts
        .filter(p => p.storagePath)
        .map(p => ({
          filename: p.fileName,
          storage_path: p.storagePath,
          size_bytes: p.file?.size ?? null,
          bucket: "project-uploads",
        }));
      const { error } = await supabase.from("inquiries").insert({
        name: form.name,
        email: form.email,
        telefon: form.phone || null,
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Upload + parts */}
          <div className="lg:col-span-2 space-y-6">
            <div
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all ${
                dragOver ? "border-primary bg-primary/5" : "border-border bg-card"
              }`}
            >
              <input
                id="file-input" type="file" multiple
                accept=".stl,.3mf,.step,.obj"
                className="hidden" onChange={handleInput}
              />
              <Upload className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="font-heading text-xl font-bold text-foreground mb-2">
                Dateien hierher ziehen
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                STL, 3MF, STEP, OBJ — bis 500MB pro Datei
              </p>
              <label htmlFor="file-input">
                <Button asChild className="gap-2 cursor-pointer">
                  <span><Upload className="w-4 h-4" /> Dateien auswählen</span>
                </Button>
              </label>
            </div>

            {parts.length > 0 && (
              <div className="space-y-3">
                {calcs.map(({ part: p, calc }) => (
                  <div key={p.id} className="bg-card rounded-2xl border border-border p-5">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <Package className="w-5 h-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{p.fileName}</p>
                          <p className="text-xs text-muted-foreground">~{calc.weight.toFixed(0)}g geschätzt</p>
                        </div>
                      </div>
                      <button onClick={() => remove(p.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <Label className="text-xs">Material</Label>
                        <select
                          value={p.materialId}
                          onChange={e => update(p.id, { materialId: e.target.value })}
                          className="mt-1 w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                        >
                          {MATERIALS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <Label className="text-xs">Farbe</Label>
                        <select
                          value={p.color}
                          onChange={e => update(p.id, { color: e.target.value })}
                          className="mt-1 w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                        >
                          {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <Label className="text-xs">Fülldichte: {p.infill}%</Label>
                        <input
                          type="range" min={5} max={100} step={5} value={p.infill}
                          onChange={e => update(p.id, { infill: Number(e.target.value) })}
                          className="mt-3 w-full accent-primary"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Menge</Label>
                        <div className="mt-1 flex items-center gap-1">
                          <button onClick={() => update(p.id, { quantity: Math.max(1, p.quantity - 1) })}
                            className="w-9 h-9 rounded-md border border-input flex items-center justify-center hover:bg-muted">
                            <Minus className="w-3 h-3" />
                          </button>
                          <Input
                            type="number" min={1}
                            value={p.quantity}
                            onChange={e => update(p.id, { quantity: Math.max(1, Number(e.target.value)) })}
                            className="h-9 text-center"
                          />
                          <button onClick={() => update(p.id, { quantity: p.quantity + 1 })}
                            className="w-9 h-9 rounded-md border border-input flex items-center justify-center hover:bg-muted">
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between pt-3 border-t border-border">
                      <span className="text-xs text-muted-foreground">
                        Stückpreis: {CHF(calc.unit)}{calc.discount > 0 && ` · ${calc.discount * 100}% Rabatt`}
                      </span>
                      <span className="text-lg font-bold text-primary">{CHF(calc.subtotal)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 bg-card rounded-2xl border border-border p-6">
              <h3 className="font-heading text-lg font-bold mb-4">Zusammenfassung</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Zwischensumme</span><span className="text-foreground">{CHF(subtotal)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Versand</span><span className="text-foreground">{shipping === 0 ? "Gratis" : CHF(shipping)}</span>
                </div>
                <div className="border-t border-border pt-3 mt-3 flex items-center justify-between">
                  <span className="font-bold">Total</span>
                  <span className="text-xl font-bold text-primary">{CHF(total)}</span>
                </div>
              </div>
              <Button
                className="w-full mt-5 gap-2"
                disabled={parts.length === 0 || submitting}
                onClick={async (e) => {
                  if (isLoggedIn && form.name && form.email) {
                    await handleSend(e as unknown as React.FormEvent);
                  } else {
                    setShowQuote(true);
                  }
                }}
              >
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Wird gesendet...</> : <>Angebot anfragen <ArrowRight className="w-4 h-4" /></>}
              </Button>
              <p className="text-xs text-muted-foreground mt-3 text-center">
                Preise sind Schätzungen. Verbindliches Angebot innerhalb 24h.
              </p>
            </div>
          </div>
        </div>

        <Dialog open={showQuote} onOpenChange={setShowQuote}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Angebot anfragen</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSend} className="space-y-4">
              <div>
                <Label className="text-xs">Name *</Label>
                <Input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">E-Mail *</Label>
                <Input type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Telefon (optional)</Label>
                <Input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Nachricht (optional)</Label>
                <Textarea rows={3} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} className="mt-1" />
              </div>
              <Button type="submit" className="w-full gap-2" disabled={submitting}>
                {submitting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Wird gesendet...</>
                  : <><Send className="w-4 h-4" /> Anfrage senden</>}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default CalculatorOnlinePage;
