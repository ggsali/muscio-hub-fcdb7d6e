import React, { useEffect, useRef, useState } from "react";
import { saveCompanySettings, uploadLogo, CompanySettings } from "@/lib/companySettings";
import { saveSettings, Settings } from "@/lib/calc";
import { useSettings } from "@/contexts/SettingsContext";
import { useCompanySettings } from "@/contexts/CompanySettingsContext";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Save, CheckCircle, Upload, Plus, Trash2, Star } from "lucide-react";
import AdminAllowlistManager from "@/components/AdminAllowlistManager";
import { toast } from "sonner";
import { loadReviewMailSettings, REVIEW_DEFAULT_SUBJECT, buildReviewBody } from "@/lib/reviewEmail";

import {
  loadQualityConfig, saveQualityConfig, DEFAULT_QUALITY_PRESETS, DEFAULT_CALC_PARAMS,
  type QualityPreset, type CalcParams,
} from "@/lib/calcConfig";


const RATE_FIELDS: { key: keyof Settings; label: string; unit: string; step: string }[] = [
  { key: "setup_pauschale", label: "Setup-Pauschale", unit: "CHF", step: "0.5" },
  { key: "material_verkauf_pro_g", label: "Material-Preis (Verkauf)", unit: "CHF / g", step: "0.001" },
  { key: "nachbearbeitung_pro_h", label: "Nachbearbeitung", unit: "CHF / h", step: "1" },
  { key: "konstruktion_pro_h", label: "Konstruktion", unit: "CHF / h", step: "1" },
  { key: "material_einkauf_pro_kg", label: "Material-Einkauf", unit: "CHF / kg", step: "0.5" },
  { key: "strom_verschleiss_pro_h", label: "Strom & Verschleiß", unit: "CHF / h", step: "0.05" },
  { key: "skalierungsziel", label: "Skalierungsziel", unit: "CHF", step: "100" },
  { key: "investitions_fonds_prozent", label: "Investitions-Fonds", unit: "%", step: "1" },
];


interface Preset {
  id?: string;
  name: string;
  beschreibung: string;
  is_default: boolean;
  setup_pauschale: number;
  material_verkauf_pro_g: number;
  maschinenzeit_pro_h: number;
  nachbearbeitung_pro_h: number;
  konstruktion_pro_h: number;
  material_einkauf_pro_kg: number;
  strom_verschleiss_pro_h: number;
  rabatt_prozent: number;
}

const PRESET_RATE_FIELDS: { key: keyof Omit<Preset, "id" | "name" | "beschreibung" | "is_default">; label: string; unit: string; step: string }[] = [
  { key: "setup_pauschale", label: "Setup-Pauschale", unit: "CHF", step: "0.5" },
  { key: "material_verkauf_pro_g", label: "Material (Verkauf)", unit: "CHF/g", step: "0.001" },
  { key: "maschinenzeit_pro_h", label: "Maschinenzeit", unit: "CHF/h", step: "0.5" },
  { key: "nachbearbeitung_pro_h", label: "Nachbearbeitung", unit: "CHF/h", step: "1" },
  { key: "konstruktion_pro_h", label: "Konstruktion", unit: "CHF/h", step: "1" },
  { key: "material_einkauf_pro_kg", label: "Material (Einkauf)", unit: "CHF/kg", step: "0.5" },
  { key: "strom_verschleiss_pro_h", label: "Strom & Verschleiß", unit: "CHF/h", step: "0.05" },
  { key: "rabatt_prozent", label: "Rabatt", unit: "%", step: "1" },
];

type Tab = "raten" | "presets" | "firma" | "rechnung" | "website" | "kalkulator" | "zugriff";

export default function EinstellungenPage() {
  const { settings, reload: reloadSettings } = useSettings();
  const { company, reload: reloadCompany } = useCompanySettings();

  const [tab, setTab] = useState<Tab>("raten");
  const [localSettings, setLocalSettings] = useState<Settings>(settings);
  const [websiteSettings, setWebsiteSettings] = useState<Record<string, number>>({
    postProcessingFee: 5,
    shippingCost: 8.9,
    freeShippingThreshold: 100,
    bulkDiscount5: 0.05,
    bulkDiscount10: 0.10,
    mwst: 0.081,
  });
  const [googleReviewUrl, setGoogleReviewUrl] = useState<string>("");
  const [reviewSubject, setReviewSubject] = useState<string>(REVIEW_DEFAULT_SUBJECT);
  const [reviewBody, setReviewBody] = useState<string>(buildReviewBody("{{name}}"));
  const [reviewAutoSend, setReviewAutoSend] = useState<boolean>(true);

  const [localCompany, setLocalCompany] = useState<CompanySettings>(company);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [editingPreset, setEditingPreset] = useState<Preset | null>(null);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingQr, setUploadingQr] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const qrInputRef = useRef<HTMLInputElement>(null);

  // Kalkulator & Qualität
  const [qualityPresets, setQualityPresets] = useState<QualityPreset[]>(DEFAULT_QUALITY_PRESETS);
  const [calcParams, setCalcParams] = useState<CalcParams>(DEFAULT_CALC_PARAMS);

  useEffect(() => { setLocalSettings(settings); }, [settings]);
  useEffect(() => { setLocalCompany(company); }, [company]);

  useEffect(() => {
    loadPresets();
    loadWebsiteSettings();
    loadGoogleReviewUrl();
    loadQualityConfig().then(({ presets, params }) => {
      setQualityPresets(presets);
      setCalcParams(params);
    });
  }, []);

  const updateQuality = (key: string, patch: Partial<QualityPreset>) =>
    setQualityPresets(qs => qs.map(q => (q.key === key ? { ...q, ...patch } : q)));

  const handleSaveQualityConfig = async () => {
    await saveQualityConfig(qualityPresets, calcParams);
    await saveSettings(localSettings);
    await reloadSettings();
    flashSaved();
    toast.success("✓ Gespeichert – Änderungen sind im Kalkulator nach einem Seiten-Reload sichtbar.");
  };


  const loadGoogleReviewUrl = async () => {
    const s = await loadReviewMailSettings();
    setGoogleReviewUrl(s.reviewUrl);
    setReviewSubject(s.subject);
    setReviewBody(s.bodyTemplate);
    setReviewAutoSend(s.autoSend);
  };

  const handleSaveGoogleReviewUrl = async () => {
    const now = new Date().toISOString();
    await supabase.from("settings").upsert(
      [
        { key: "google_review_url", value: googleReviewUrl, updated_at: now },
        { key: "review_email_subject", value: reviewSubject, updated_at: now },
        { key: "review_email_body", value: reviewBody, updated_at: now },
        { key: "review_auto_send", value: reviewAutoSend ? "true" : "false", updated_at: now },
      ],
      { onConflict: "key" },
    );
    flashSaved();
  };


  const loadWebsiteSettings = async () => {
    const { data } = await supabase.from("settings").select("*").in("key", [
      "postProcessingFee", "shippingCost", "freeShippingThreshold", "bulkDiscount5", "bulkDiscount10", "mwst",
    ]);
    if (data && data.length > 0) {
      const ws: Record<string, number> = {};
      for (const row of data) ws[row.key] = parseFloat(row.value);
      setWebsiteSettings(prev => ({ ...prev, ...ws }));
    }
  };

  const handleSaveWebsiteSettings = async () => {
    const entries = Object.entries(websiteSettings).map(([key, value]) => ({
      key, value: String(value), updated_at: new Date().toISOString(),
    }));
    for (const entry of entries) {
      await supabase.from("settings").upsert(entry, { onConflict: "key" });
    }
    flashSaved();
  };

  const loadPresets = async () => {
    const { data } = await supabase.from("price_presets").select("*").order("created_at");
    if (data) setPresets(data as Preset[]);
  };

  const handleSaveSettings = async () => {
    await saveSettings(localSettings);
    await reloadSettings();
    flashSaved();
  };

  const handleSaveCompany = async () => {
    await saveCompanySettings(localCompany);
    await reloadCompany();
    flashSaved();
  };

  const flashSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadLogo(file);
      setLocalCompany(prev => ({ ...prev, logo_url: url }));
    } finally {
      setUploading(false);
    }
  };

  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingQr(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `qr_bill.${ext}`;
      const { error } = await supabase.storage
        .from("company-assets")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("company-assets").getPublicUrl(path);
      const url = data.publicUrl + `?t=${Date.now()}`;
      setLocalCompany(prev => ({ ...prev, qr_bill_image_url: url }));
    } finally {
      setUploadingQr(false);
    }
  };

  const emptyPreset = (): Preset => ({
    name: "Neues Preset",
    beschreibung: "",
    is_default: false,
    setup_pauschale: settings.setup_pauschale,
    material_verkauf_pro_g: settings.material_verkauf_pro_g,
    maschinenzeit_pro_h: settings.maschinenzeit_pro_h,
    nachbearbeitung_pro_h: settings.nachbearbeitung_pro_h,
    konstruktion_pro_h: settings.konstruktion_pro_h,
    material_einkauf_pro_kg: settings.material_einkauf_pro_kg,
    strom_verschleiss_pro_h: settings.strom_verschleiss_pro_h,
    rabatt_prozent: 0,
  });

  const handleSavePreset = async () => {
    if (!editingPreset) return;
    if (editingPreset.id) {
      await supabase.from("price_presets").update(editingPreset).eq("id", editingPreset.id);
    } else {
      await supabase.from("price_presets").insert(editingPreset);
    }
    await loadPresets();
    setEditingPreset(null);
    flashSaved();
  };

  const handleDeletePreset = async (id: string) => {
    await supabase.from("price_presets").delete().eq("id", id);
    await loadPresets();
  };

  const handleSetDefault = async (id: string) => {
    await supabase.from("price_presets").update({ is_default: false }).neq("id", id);
    await supabase.from("price_presets").update({ is_default: true }).eq("id", id);
    await loadPresets();
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: "raten", label: "Verrechnungssätze" },
    { key: "presets", label: "Preis-Presets" },
    { key: "website", label: "Website-Kalkulator" },
    { key: "kalkulator", label: "Kalkulator & Qualität" },

    { key: "firma", label: "Firmenangaben" },
    { key: "rechnung", label: "Rechnungs-Design" },
    { key: "zugriff", label: "Admin-Zugriff" },
  ];

  return (
    <div className="p-4 md:p-6 animate-fade-in">
      <div className="mb-4 md:mb-6">
        <h1 className="text-xl md:text-2xl font-bold">Einstellungen</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Preise, Firmeninfos & Rechnungsdesign</p>
      </div>

      {/* Tabs — horizontal scrollbar auf Mobile */}
      <div className="flex gap-1 mb-4 md:mb-6 border-b border-border overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0 scrollbar-none">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 md:px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap flex-shrink-0 ${
              tab === t.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>


      {/* ── Tab: Verrechnungssätze ── */}
      {tab === "raten" && (
        <div className="bg-card border border-border rounded-lg p-4 md:p-5 max-w-full md:max-w-lg space-y-4">
          {RATE_FIELDS.map(f => (
            <div key={f.key} className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <Label className="text-sm">{f.label}</Label>
                <div className="text-xs text-muted-foreground">{f.unit}</div>
              </div>
              <Input
                type="number"
                step={f.step}
                value={localSettings[f.key] || ""}
                onChange={e => setLocalSettings({ ...localSettings, [f.key]: parseFloat(e.target.value) || 0 })}
                className="w-28 md:w-32 bg-input border-border text-right tabular-nums flex-shrink-0"
              />
            </div>
          ))}
          <div className="pt-2">
            <SaveButton saved={saved} onClick={handleSaveSettings} />
          </div>
        </div>
      )}

      {/* ── Tab: Preis-Presets ── */}
      {tab === "presets" && (
        <div className="space-y-4 max-w-full md:max-w-2xl">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Presets sind beim Auftrag auswählbar und überschreiben die Standard-Verrechnungssätze.</p>
            <Button size="sm" onClick={() => setEditingPreset(emptyPreset())} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Neu
            </Button>
          </div>

          {presets.length === 0 && !editingPreset && (
            <div className="bg-card border border-border rounded-lg p-4 md:p-8 text-center text-muted-foreground text-sm">
              Noch keine Presets. Erstelle dein erstes Preset.
            </div>
          )}

          <div className="space-y-3">
            {presets.map(p => (
              <div key={p.id} className="bg-card border border-border rounded-lg p-4 flex items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{p.name}</span>
                    {p.is_default && (
                      <span className="bg-primary/20 text-primary text-xs px-2 py-0.5 rounded-full">Standard</span>
                    )}
                    {p.rabatt_prozent > 0 && (
                      <span className="bg-success/20 text-success text-xs px-2 py-0.5 rounded-full">-{p.rabatt_prozent}% Rabatt</span>
                    )}
                  </div>
                  {p.beschreibung && <p className="text-xs text-muted-foreground mt-0.5">{p.beschreibung}</p>}
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="text-xs text-muted-foreground">Setup: CHF {p.setup_pauschale}</span>
                    <span className="text-xs text-muted-foreground">Mat: {p.material_verkauf_pro_g}/g</span>
                    <span className="text-xs text-muted-foreground">Maschine: {p.maschinenzeit_pro_h}/h</span>
                    <span className="text-xs text-muted-foreground">NB: {p.nachbearbeitung_pro_h}/h</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  {!p.is_default && (
                    <button onClick={() => handleSetDefault(p.id!)} title="Als Standard setzen" className="text-muted-foreground hover:text-primary transition-colors p-1.5">
                      <Star className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={() => setEditingPreset({ ...p })} className="text-muted-foreground hover:text-foreground transition-colors p-1.5 text-xs">
                    Bearbeiten
                  </button>
                  <button onClick={() => handleDeletePreset(p.id!)} className="text-muted-foreground hover:text-destructive transition-colors p-1.5">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Edit modal */}
          {editingPreset && (
            <div className="bg-card border border-primary/30 rounded-lg p-5 space-y-4">
              <h3 className="font-semibold text-sm">{editingPreset.id ? "Preset bearbeiten" : "Neues Preset"}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Name</Label>
                  <Input value={editingPreset.name} onChange={e => setEditingPreset({ ...editingPreset, name: e.target.value })} className="bg-input border-border h-8 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Beschreibung (optional)</Label>
                  <Input value={editingPreset.beschreibung} onChange={e => setEditingPreset({ ...editingPreset, beschreibung: e.target.value })} className="bg-input border-border h-8 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {PRESET_RATE_FIELDS.map(f => (
                  <div key={f.key} className="flex items-center justify-between gap-2">
                    <div>
                      <Label className="text-xs">{f.label}</Label>
                      <div className="text-xs text-muted-foreground">{f.unit}</div>
                    </div>
                    <Input
                      type="number"
                      step={f.step}
                      value={(editingPreset as any)[f.key] ?? ""}
                      onChange={e => setEditingPreset({ ...editingPreset, [f.key]: parseFloat(e.target.value) || 0 })}
                      className="w-20 md:w-24 bg-input border-border text-right tabular-nums h-8 text-sm flex-shrink-0"
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <SaveButton saved={saved} onClick={handleSavePreset} />
                <Button variant="outline" size="sm" onClick={() => setEditingPreset(null)} className="border-border">Abbrechen</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Kalkulator & Qualität ── */}
      {tab === "kalkulator" && (
        <div className="space-y-4 max-w-full md:max-w-2xl">
          <div className="bg-muted/50 border border-border rounded-lg px-4 py-3 text-sm text-muted-foreground">
            Qualitätsstufen und Kalkulationsparameter des Online-Kalkulators. Der <strong>Geschwindigkeitsfaktor</strong> korrigiert
            die Slicer-Druckzeit (1.0 = kein Eingriff, 0.8 = 20 % schneller).
          </div>

          <div className="space-y-3">
            {qualityPresets.map(q => (
              <div key={q.key} className="bg-card border border-border rounded-lg p-4 space-y-3">
                <h3 className="font-semibold text-sm uppercase tracking-wide">{q.label}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Schichthöhe (mm)</Label>
                    <Input
                      type="number" step="0.01" min="0.05"
                      value={q.layerHeight}
                      onChange={e => updateQuality(q.key, { layerHeight: parseFloat(e.target.value) || 0 })}
                      className="bg-input border-border text-right tabular-nums mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Infill (%)</Label>
                    <Input
                      type="number" step="1" min="0" max="100"
                      value={q.infill}
                      onChange={e => updateQuality(q.key, { infill: parseFloat(e.target.value) || 0 })}
                      className="bg-input border-border text-right tabular-nums mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Geschwindigkeitsfaktor</Label>
                    <Input
                      type="number" step="0.05" min="0.1"
                      value={q.speedFactor}
                      onChange={e => updateQuality(q.key, { speedFactor: parseFloat(e.target.value) || 0 })}
                      className="bg-input border-border text-right tabular-nums mt-1"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-card border border-border rounded-lg p-4 md:p-5 space-y-4">
            <h3 className="font-semibold text-sm">Globale Kalkulationsparameter</h3>
            {[
              { label: "Fixkosten pro Auftrag", unit: "CHF", step: "0.5", value: calcParams.fix_cost, set: (v: number) => setCalcParams({ ...calcParams, fix_cost: v }) },
              { label: "Support-Aufschlag", unit: "CHF", step: "0.5", value: calcParams.support_surcharge, set: (v: number) => setCalcParams({ ...calcParams, support_surcharge: v }) },
              { label: "Mindestpreis", unit: "CHF", step: "0.5", value: calcParams.min_price, set: (v: number) => setCalcParams({ ...calcParams, min_price: v }) },
              { label: "Maschinenzeit", unit: "CHF / h", step: "0.5", value: localSettings.maschinenzeit_pro_h, set: (v: number) => setLocalSettings({ ...localSettings, maschinenzeit_pro_h: v }) },
            ].map(f => (
              <div key={f.label} className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label className="text-sm">{f.label}</Label>
                  <div className="text-xs text-muted-foreground">{f.unit}</div>
                </div>
                <Input
                  type="number" step={f.step}
                  value={f.value ?? ""}
                  onChange={e => f.set(parseFloat(e.target.value) || 0)}
                  className="w-28 md:w-32 bg-input border-border text-right tabular-nums flex-shrink-0"
                />
              </div>
            ))}
            <div className="pt-2">
              <SaveButton saved={saved} onClick={handleSaveQualityConfig} />
            </div>
          </div>
        </div>
      )}


      {tab === "website" && (
        <div className="space-y-4 max-w-full md:max-w-lg">
          <div className="bg-muted/50 border border-border rounded-lg px-4 py-3 text-sm text-muted-foreground">
            Diese Einstellungen steuern den öffentlichen Kalkulator auf der <strong>3D Print Studio Website</strong>. Änderungen werden sofort für Besucher übernommen.
          </div>
          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <h3 className="font-semibold text-sm">Kalkulator-Parameter</h3>
            {[
              { key: "postProcessingFee", label: "Nachbearbeitung Pauschale", unit: "CHF / Bestellung", step: "0.5" },
              { key: "shippingCost", label: "Versandkosten", unit: "CHF", step: "0.1" },
              { key: "freeShippingThreshold", label: "Gratis-Versand ab", unit: "CHF", step: "5" },
              { key: "bulkDiscount5", label: "Mengenrabatt ab 5 Stk.", unit: "Faktor (0.05 = 5%)", step: "0.01" },
              { key: "bulkDiscount10", label: "Mengenrabatt ab 10 Stk.", unit: "Faktor (0.10 = 10%)", step: "0.01" },
              { key: "mwst", label: "Mehrwertsteuer", unit: "Faktor (0.081 = 8.1%)", step: "0.001" },
            ].map(f => (
              <div key={f.key} className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label className="text-sm">{f.label}</Label>
                  <div className="text-xs text-muted-foreground">{f.unit}</div>
                </div>
                <Input
                  type="number"
                  step={f.step}
                  value={websiteSettings[f.key] ?? ""}
                  onChange={e => setWebsiteSettings(prev => ({ ...prev, [f.key]: parseFloat(e.target.value) || 0 }))}
                  className="w-28 md:w-32 bg-input border-border text-right tabular-nums flex-shrink-0"
                />
              </div>
            ))}
          </div>
          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <h3 className="font-semibold text-sm">Verrechnungssätze (wird vom ERP übernommen)</h3>
            <p className="text-xs text-muted-foreground">Die Preise pro Gramm, Druckzeit etc. werden aus den Verrechnungssätzen oben automatisch für den Website-Kalkulator verwendet.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Material / g:</span><span className="font-mono">CHF {settings.material_verkauf_pro_g.toFixed(3)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Maschinenzeit / h:</span><span className="font-mono">CHF {settings.maschinenzeit_pro_h.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Material Einkauf / kg:</span><span className="font-mono">CHF {settings.material_einkauf_pro_kg.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Strom & Verschleiß / h:</span><span className="font-mono">CHF {settings.strom_verschleiss_pro_h.toFixed(2)}</span></div>
            </div>
          </div>
          <SaveButton saved={saved} onClick={handleSaveWebsiteSettings} />
        </div>
      )}


      {tab === "firma" && (
        <div className="space-y-6 max-w-full md:max-w-lg">
          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <h3 className="font-semibold text-sm">Firmendaten</h3>
            {([
              { key: "firmenname", label: "Firmenname" },
              { key: "slogan", label: "Slogan / Untertitel" },
              { key: "adresse", label: "Adresse" },
              { key: "uid_nummer", label: "UID-Nummer (MwSt.)" },
              { key: "telefon", label: "Telefon" },
              { key: "email", label: "E-Mail" },
              { key: "website", label: "Website" },
            ] as { key: keyof CompanySettings; label: string }[]).map(f => (
              <div key={f.key} className="flex flex-col md:flex-row md:items-center md:justify-between gap-1.5 md:gap-4">
                <Label className="text-sm flex-1">{f.label}</Label>
                <Input
                  value={(localCompany as any)[f.key] || ""}
                  onChange={e => setLocalCompany({ ...localCompany, [f.key]: e.target.value })}
                  className="w-full md:w-56 bg-input border-border text-sm flex-shrink-0"
                />
              </div>
            ))}
          </div>
          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <h3 className="font-semibold text-sm">Bankverbindung</h3>
            {([
              { key: "bank_inhaber", label: "Kontoinhaber" },
              { key: "bank_iban", label: "IBAN" },
              { key: "bank_name", label: "Bank" },
            ] as { key: keyof CompanySettings; label: string }[]).map(f => (
              <div key={f.key} className="flex flex-col md:flex-row md:items-center md:justify-between gap-1.5 md:gap-4">
                <Label className="text-sm flex-1">{f.label}</Label>
                <Input
                  value={(localCompany as any)[f.key] || ""}
                  onChange={e => setLocalCompany({ ...localCompany, [f.key]: e.target.value })}
                  className="w-full md:w-56 bg-input border-border text-sm flex-shrink-0"
                />
              </div>
            ))}
          </div>
          <SaveButton saved={saved} onClick={handleSaveCompany} />

          <div className="bg-card border border-border rounded-lg p-5 space-y-3">
            <div>
              <h3 className="font-semibold text-sm">Google Rezensions-Link</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Wird in Rezensions-Anfragen an Kunden verlinkt (z.B. https://g.page/r/XXXXX/review).</p>
            </div>
            <Input
              value={googleReviewUrl}
              onChange={e => setGoogleReviewUrl(e.target.value)}
              placeholder="https://g.page/r/XXXXX/review"
              className="bg-input border-border text-sm"
            />

            <div className="pt-2 border-t border-border space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-sm">Automatischer Versand</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Sendet die Dankes-/Rezensions-Mail automatisch, sobald ein Auftrag als «Abgeschlossen» gespeichert wird (einmal pro Auftrag).
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={reviewAutoSend}
                  onChange={e => setReviewAutoSend(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-primary"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Betreff</Label>
                <Input
                  value={reviewSubject}
                  onChange={e => setReviewSubject(e.target.value)}
                  className="bg-input border-border text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  E-Mail-Text — Platzhalter: {"{{name}}"}, {"{{firma}}"} und [Google Rezension schreiben] (wird verlinkt)
                </Label>
                <Textarea
                  value={reviewBody}
                  onChange={e => setReviewBody(e.target.value)}
                  rows={14}
                  className="bg-input border-border text-sm font-mono"
                />
              </div>
            </div>

            <SaveButton saved={saved} onClick={handleSaveGoogleReviewUrl} />
          </div>

        </div>
      )}

      {/* ── Tab: Rechnungs-Design ── */}
      {tab === "rechnung" && (
        <div className="space-y-6 max-w-lg">
          <div className="bg-card border border-border rounded-lg p-5 space-y-5">
            <h3 className="font-semibold text-sm">Logo</h3>
            <div className="flex items-center gap-4">
              {localCompany.logo_url && (
                <img src={localCompany.logo_url} alt="Logo" className="h-14 w-auto rounded border border-border object-contain bg-white p-1" />
              )}
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-border"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="w-3.5 h-3.5" />
                  {uploading ? "Hochladen..." : "Logo hochladen"}
                </Button>
                <p className="text-xs text-muted-foreground mt-1">PNG, SVG oder JPG – wird im PDF oben links angezeigt</p>
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label className="text-sm">Primärfarbe</Label>
                <p className="text-xs text-muted-foreground">Header & Akzente im PDF</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={localCompany.primary_color || "#FF5A00"}
                  onChange={e => setLocalCompany({ ...localCompany, primary_color: e.target.value })}
                  className="w-10 h-10 rounded cursor-pointer border border-border bg-transparent p-0.5"
                />
                <Input
                  value={localCompany.primary_color || "#FF5A00"}
                  onChange={e => setLocalCompany({ ...localCompany, primary_color: e.target.value })}
                  className="w-28 bg-input border-border text-sm font-mono"
                  placeholder="#FF5A00"
                />
              </div>
            </div>

            {/* Preview */}
            <div className="mt-2 rounded border border-border overflow-hidden">
              <div style={{ backgroundColor: localCompany.primary_color || "#FF5A00" }} className="px-4 py-3 flex items-center justify-between">
                {localCompany.logo_url
                  ? <img src={localCompany.logo_url} alt="Logo" className="h-8 w-auto object-contain" />
                  : <span className="text-white font-bold text-lg">{localCompany.firmenname || "Firmenname"}</span>
                }
                <div className="text-right">
                  <div className="text-white text-xs font-bold">AUFTRAGSÜBERSICHT</div>
                  <div className="text-white/80 text-xs">{new Date().toLocaleDateString("de-CH")}</div>
                </div>
              </div>
              <div className="bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
                {localCompany.slogan || "Slogan wird hier angezeigt"}
              </div>
            </div>
          </div>

          {/* QR-Bill Upload */}
          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <div>
              <h3 className="font-semibold text-sm">Einzahlungsschein (QR-Rechnung)</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Lade dein eigenes QR-Einzahlungsschein-Bild hoch (PNG/JPG). Es wird automatisch als zweite Seite an jede Rechnung angehängt.</p>
            </div>
            {localCompany.qr_bill_image_url && (
              <div className="space-y-2">
                <img
                  src={localCompany.qr_bill_image_url}
                  alt="QR-Einzahlungsschein"
                  className="w-full max-w-sm rounded border border-border object-contain bg-white p-2"
                />
                <button
                  onClick={() => setLocalCompany(prev => ({ ...prev, qr_bill_image_url: "" }))}
                  className="text-xs text-destructive hover:underline"
                >
                  Bild entfernen
                </button>
              </div>
            )}
            <div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-border"
                onClick={() => qrInputRef.current?.click()}
                disabled={uploadingQr}
              >
                <Upload className="w-3.5 h-3.5" />
                {uploadingQr ? "Hochladen..." : localCompany.qr_bill_image_url ? "Bild ersetzen" : "Bild hochladen"}
              </Button>
              <input ref={qrInputRef} type="file" accept="image/*" className="hidden" onChange={handleQrUpload} />
            </div>
          </div>

          {/* Zahlungsbedingungen */}
          <div className="space-y-2">
            <Label className="text-sm">Zahlungsbedingungen</Label>
            <Textarea
              value={localCompany.zahlungsbedingungen || ""}
              onChange={e => setLocalCompany({ ...localCompany, zahlungsbedingungen: e.target.value })}
              rows={3}
              className="bg-input border-border text-sm resize-none"
              placeholder="Zahlung fällig innerhalb von 30 Tagen nach Rechnungsdatum..."
            />
            <p className="text-xs text-muted-foreground">Wird auf jeder Rechnung unterhalb des Gesamtbetrags angezeigt.</p>
          </div>

          <SaveButton saved={saved} onClick={handleSaveCompany} />
        </div>
      )}

      {tab === "zugriff" && <AdminAllowlistManager />}
    </div>
  );
}

function SaveButton({ saved, onClick }: { saved: boolean; onClick: () => void }) {
  return (
    <Button
      onClick={onClick}
      className={`gap-2 ${saved ? "bg-success hover:bg-success/90" : "bg-primary hover:bg-primary/90"}`}
    >
      {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
      {saved ? "Gespeichert!" : "Speichern"}
    </Button>
  );
}
