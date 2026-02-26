import React, { useState } from "react";
import { useSettings } from "@/contexts/SettingsContext";
import { calcUmsatz, calcKosten, calcGewinn, calcMarge, formatCHF, formatPct } from "@/lib/calc";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { RotateCcw } from "lucide-react";

export default function KalkulatorPage() {
  const { settings } = useSettings();
  const navigate = useNavigate();

  const [gewicht, setGewicht] = useState(0);
  const [druckzeit, setDruckzeit] = useState(0);
  const [nachbearbeitung, setNachbearbeitung] = useState(0);
  const [konstruktion, setKonstruktion] = useState(0);
  const [menge, setMenge] = useState(1);

  const preisPro = calcUmsatz(settings, gewicht, druckzeit, nachbearbeitung, konstruktion);
  const preisTotal = preisPro * menge;
  const kosten = calcKosten(settings, gewicht, druckzeit) * menge;
  const gewinn = calcGewinn(preisTotal, kosten);
  const marge = calcMarge(gewinn, preisTotal);

  const setupAnteil = settings.setup_pauschale;
  const matAnteil = gewicht * settings.material_verkauf_pro_g;
  const maschAnteil = druckzeit * settings.maschinenzeit_pro_h;
  const nbAnteil = nachbearbeitung * settings.nachbearbeitung_pro_h;
  const konstrAnteil = konstruktion * settings.konstruktion_pro_h;

  const reset = () => {
    setGewicht(0); setDruckzeit(0); setNachbearbeitung(0); setKonstruktion(0); setMenge(1);
  };

  const field = (label: string, value: number, setter: (v: number) => void, step = 0.1, unit = "") => (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}{unit && <span className="text-muted-foreground ml-1">({unit})</span>}</Label>
      <Input
        type="number"
        value={value || ""}
        onChange={e => setter(parseFloat(e.target.value) || 0)}
        step={step}
        min={0}
        className="bg-input border-border text-lg h-11 tabular-nums"
        placeholder="0"
      />
    </div>
  );

  return (
    <div className="p-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Kalkulator</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Schnellkalkulation ohne Auftrag zu erstellen</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
        {/* Inputs */}
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <h2 className="font-semibold">Eingabe</h2>
          <div className="grid grid-cols-2 gap-4">
            {field("Gewicht", gewicht, setGewicht, 0.1, "g")}
            {field("Druckzeit", druckzeit, setDruckzeit, 0.1, "h")}
            {field("Nachbearbeitung", nachbearbeitung, setNachbearbeitung, 0.1, "h")}
            {field("Konstruktion", konstruktion, setKonstruktion, 0.1, "h")}
            {field("Menge", menge, setMenge, 1, "Stk.")}
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => navigate("/auftraege/neu")}
              className="bg-primary hover:bg-primary/90 flex-1"
            >
              Als Auftrag speichern
            </Button>
            <Button variant="outline" onClick={reset} className="gap-2 border-border">
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Result */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="font-semibold mb-4">Live-Ergebnis</h2>
          <div className="space-y-2 text-sm">
            <ResultRow label="Setup" value={formatCHF(setupAnteil)} />
            <ResultRow label="Material" value={formatCHF(matAnteil)} />
            <ResultRow label="Maschinenzeit" value={formatCHF(maschAnteil)} />
            <ResultRow label="Nachbearbeitung" value={formatCHF(nbAnteil)} />
            <ResultRow label="Konstruktion" value={formatCHF(konstrAnteil)} />
            <div className="border-t border-border my-3" />
            <ResultRow label="Preis pro Stück" value={formatCHF(preisPro)} bold highlight />
            <ResultRow label={`Preis Total (×${menge})`} value={formatCHF(preisTotal)} bold />
            <div className="border-t border-border my-3" />
            <ResultRow label="Meine Kosten" value={formatCHF(kosten)} muted />
            <ResultRow label="Gewinn" value={formatCHF(gewinn)} success />
            <ResultRow label="Marge" value={formatPct(marge)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultRow({ label, value, bold, highlight, muted, success }: {
  label: string; value: string; bold?: boolean; highlight?: boolean; muted?: boolean; success?: boolean;
}) {
  return (
    <div className={`flex justify-between items-center py-0.5 ${bold ? "font-semibold" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${highlight ? "text-primary text-base" : success ? "text-success" : muted ? "text-destructive" : ""}`}>
        {value}
      </span>
    </div>
  );
}
