import React, { useEffect, useState } from "react";
import { Calculator, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrationssupabase/client".replace("integrationssupabase","integrations/supabase");
import { useToast } from "@/hooks/use-toast";
import { formatCHF } from "@/lib/calc";

interface Material { material: string; preis_pro_g: number; }

export default function CalculatorOnlinePage() {
  const { toast } = useToast();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [material, setMaterial] = useState("");
  const [gewicht, setGewicht] = useState<number>(50);
  const [druckzeit, setDruckzeit] = useState<number>(2);
  const [menge, setMenge] = useState<number>(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [nachricht, setNachricht] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("website_settings").select("value").eq("key", "material_preise").maybeSingle();
      const list = (data?.value as any)?.eintraege as Material[] | undefined;
      const final = list?.length ? list : [
        { material: "PLA Standard", preis_pro_g: 0.055 },
        { material: "PETG", preis_pro_g: 0.065 },
        { material: "ABS / ASA", preis_pro_g: 0.075 },
        { material: "TPU Flexibel", preis_pro_g: 0.090 },
      ];
      setMaterials(final);
      setMaterial(final[0].material);
    })();
  }, []);

  const selected = materials.find(m => m.material === material);
  const matKosten = (selected?.preis_pro_g || 0) * gewicht;
  const druckKosten = druckzeit * 3; // CHF/h Maschine
  const setup = 20;
  const proStueck = matKosten + druckKosten;
  const richtpreis = (proStueck + setup) * menge;

  const sendInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    const text = `Online-Kalkulation:
Material: ${material}
Gewicht: ${gewicht} g
Druckzeit: ${druckzeit} h
Menge: ${menge}
Geschätzter Richtpreis: ${formatCHF(richtpreis)}

Nachricht des Kunden:
${nachricht || "—"}`;

    const { error } = await supabase.from("inquiries").insert({
      name, email,
      betreff: `Online-Kalkulation – ${material}`,
      nachricht: text,
      quelle: "website",
    });
    setSending(false);
    if (error) toast({ title: "Senden fehlgeschlagen", description: error.message, variant: "destructive" });
    else setDone(true);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-12 md:py-16">
      <div className="flex items-center gap-3 mb-2">
        <Calculator className="w-6 h-6 text-primary" />
        <h1 className="text-3xl md:text-4xl font-bold">Online-Preisrechner</h1>
      </div>
      <p className="text-muted-foreground mb-10">
        Trage deine Werte ein und erhalte einen unverbindlichen Richtpreis. Für ein verbindliches Angebot senden wir dir nach kurzer Prüfung einen Festpreis.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Eingabe */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h3 className="font-semibold">Druckparameter</h3>

          <div>
            <Label>Material</Label>
            <select
              value={material}
              onChange={e => setMaterial(e.target.value)}
              className="w-full mt-1 bg-input border border-border rounded-md px-3 py-2 text-sm"
            >
              {materials.map(m => (
                <option key={m.material} value={m.material}>
                  {m.material} ({formatCHF(m.preis_pro_g)}/g)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Gewicht (g)</Label>
              <Input type="number" min={1} value={gewicht} onChange={e => setGewicht(Number(e.target.value))} className="bg-input border-border" />
            </div>
            <div>
              <Label>Druckzeit (h)</Label>
              <Input type="number" min={0} step="0.1" value={druckzeit} onChange={e => setDruckzeit(Number(e.target.value))} className="bg-input border-border" />
            </div>
          </div>

          <div>
            <Label>Stückzahl</Label>
            <Input type="number" min={1} value={menge} onChange={e => setMenge(Number(e.target.value))} className="bg-input border-border" />
          </div>
        </div>

        {/* Ergebnis & Anfrage */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h3 className="font-semibold">Richtpreis</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Material ({gewicht} g)</span><span>{formatCHF(matKosten)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Maschinenzeit ({druckzeit} h)</span><span>{formatCHF(druckKosten)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Setup-Pauschale</span><span>{formatCHF(setup)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Stückzahl</span><span>× {menge}</span></div>
            <div className="border-t border-border pt-2 mt-2 flex justify-between text-base font-bold">
              <span>Richtpreis</span>
              <span className="text-primary">{formatCHF(richtpreis)}</span>
            </div>
          </div>

          {done ? (
            <div className="text-center py-6 border-t border-border">
              <p className="font-medium text-success">Anfrage erhalten – wir melden uns!</p>
            </div>
          ) : (
            <form onSubmit={sendInquiry} className="space-y-3 border-t border-border pt-4">
              <p className="text-xs text-muted-foreground">Anfrage senden mit dieser Kalkulation:</p>
              <div className="grid grid-cols-2 gap-3">
                <Input required placeholder="Dein Name" value={name} onChange={e => setName(e.target.value)} className="bg-input border-border" />
                <Input required type="email" placeholder="E-Mail" value={email} onChange={e => setEmail(e.target.value)} className="bg-input border-border" />
              </div>
              <Textarea placeholder="Optionale Nachricht…" value={nachricht} onChange={e => setNachricht(e.target.value)} rows={3} className="bg-input border-border" />
              <Button type="submit" disabled={sending} className="w-full gap-2">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Anfrage mit Kalkulation senden
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
