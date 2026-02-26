import React, { useEffect, useState } from "react";
import { saveSettings, Settings } from "@/lib/calc";
import { useSettings } from "@/contexts/SettingsContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save, CheckCircle } from "lucide-react";

const FIELDS: { key: keyof Settings; label: string; unit: string; step: string }[] = [
  { key: "setup_pauschale", label: "Setup-Pauschale", unit: "CHF", step: "0.5" },
  { key: "material_verkauf_pro_g", label: "Material-Preis (Verkauf)", unit: "CHF / g", step: "0.001" },
  { key: "maschinenzeit_pro_h", label: "Maschinenzeit", unit: "CHF / h", step: "0.5" },
  { key: "nachbearbeitung_pro_h", label: "Nachbearbeitung", unit: "CHF / h", step: "1" },
  { key: "konstruktion_pro_h", label: "Konstruktion", unit: "CHF / h", step: "1" },
  { key: "material_einkauf_pro_kg", label: "Material-Einkauf", unit: "CHF / kg", step: "0.5" },
  { key: "strom_verschleiss_pro_h", label: "Strom & Verschleiß", unit: "CHF / h", step: "0.05" },
  { key: "skalierungsziel", label: "Skalierungsziel", unit: "CHF", step: "100" },
  { key: "investitions_fonds_prozent", label: "Investitions-Fonds", unit: "%", step: "1" },
];

export default function EinstellungenPage() {
  const { settings, reload } = useSettings();
  const [local, setLocal] = useState<Settings>(settings);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setLocal(settings); }, [settings]);

  const handleSave = async () => {
    await saveSettings(local);
    await reload();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Einstellungen</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Verrechnungssätze – wirken auf alle Berechnungen</p>
      </div>

      <div className="bg-card border border-border rounded-lg p-5 max-w-lg space-y-4">
        {FIELDS.map(f => (
          <div key={f.key} className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <Label className="text-sm">{f.label}</Label>
              <div className="text-xs text-muted-foreground">{f.unit}</div>
            </div>
            <Input
              type="number"
              step={f.step}
              value={local[f.key] || ""}
              onChange={e => setLocal({ ...local, [f.key]: parseFloat(e.target.value) || 0 })}
              className="w-32 bg-input border-border text-right tabular-nums"
            />
          </div>
        ))}

        <div className="pt-2">
          <Button onClick={handleSave} className={`gap-2 ${saved ? "bg-success hover:bg-success/90" : "bg-primary hover:bg-primary/90"}`}>
            {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? "Gespeichert!" : "Speichern"}
          </Button>
        </div>
      </div>
    </div>
  );
}
