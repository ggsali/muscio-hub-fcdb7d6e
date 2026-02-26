import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/contexts/SettingsContext";
import { calcUmsatz, calcKosten, calcGewinn, calcMarge, formatCHF, formatPct, Settings } from "@/lib/calc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowLeft, Plus, Trash2, Save, FileDown, Tag, Paperclip } from "lucide-react";
import { exportOrderPDF } from "@/lib/pdfExport";
import { exportOfferPDF } from "@/lib/pdfOfferExport";
import { useCompanySettings } from "@/contexts/CompanySettingsContext";
import PartFileUpload from "@/components/PartFileUpload";
import type { Filament } from "@/pages/FilamentePage";
import OrderStatusWorkflow from "@/components/OrderStatusWorkflow";

interface PartRow {
  id?: string;
  teilname: string;
  material: string;
  filament_id?: string;
  filament_einkauf_pro_kg?: number; // individueller Filamentpreis
  menge: number;
  gewicht_g: number;
  druckzeit_h: number;
  nachbearbeitung_h: number;
  konstruktion_h: number;
  preis_pro_stueck: number;
  preis_total: number;
  status: "Ausstehend" | "In Druck" | "Fertig" | "Geliefert";
  notizen: string;
}

const emptyPart = (): PartRow => ({
  teilname: "", material: "PLA", filament_id: "", menge: 1,
  gewicht_g: 0, druckzeit_h: 0, nachbearbeitung_h: 0, konstruktion_h: 0,
  preis_pro_stueck: 0, preis_total: 0,
  status: "Ausstehend", notizen: "",
});

interface Preset {
  id: string;
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

const STATUS_OPTIONS = ["Offen", "In Bearbeitung", "Abgeschlossen", "Storniert"];
const PART_STATUS_OPTIONS = ["Ausstehend", "In Druck", "Fertig", "Geliefert"];
const FALLBACK_MATERIALS = ["PLA", "PETG", "TPU", "Sonstige"];

export default function AuftragDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === "neu";
  const searchParams = new URLSearchParams(window.location.search);
  const preselectedCustomerId = searchParams.get("customer_id") || "";
  const { settings } = useSettings();
  const { company } = useCompanySettings();

  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [expandedPartIdx, setExpandedPartIdx] = useState<number | null>(null);
  const [activeSettings, setActiveSettings] = useState<Settings>(settings);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");
  const [customerId, setCustomerId] = useState(preselectedCustomerId);
  const [beschreibung, setBeschreibung] = useState("");
  const [datum, setDatum] = useState(new Date().toISOString().split("T")[0]);
  const [status, setStatus] = useState("Offen");
  const [trackingNr, setTrackingNr] = useState("");
  const [parts, setParts] = useState<PartRow[]>([emptyPart()]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("customers").select("id, name").then(({ data }) => {
      if (data) setCustomers(data);
    });
    supabase.from("price_presets").select("*").order("created_at").then(({ data }) => {
      if (data) {
        setPresets(data as Preset[]);
        const def = data.find((p: any) => p.is_default);
        if (def && isNew) {
          setSelectedPresetId(def.id);
          setActiveSettings({ ...settings, ...def });
        }
      }
    });
    supabase.from("filaments").select("*").eq("aktiv", true).order("material").order("name").then(({ data }) => {
      if (data) setFilaments(data as Filament[]);
    });

    if (!isNew) {
      async function load() {
        const { data: o } = await supabase.from("orders").select("*").eq("id", id!).single();
        if (o) {
          setCustomerId(o.customer_id || "");
          setBeschreibung(o.beschreibung || "");
          setDatum(o.datum);
          setStatus(o.status);
        }
        const { data: p } = await supabase.from("parts").select("*").eq("order_id", id!);
        if (p && p.length > 0) setParts(p as PartRow[]);
        setLoading(false);
      }
      load();
    }
  }, [id]);

  const handlePresetChange = (presetId: string) => {
    setSelectedPresetId(presetId);
    if (!presetId) {
      setActiveSettings(settings);
      return;
    }
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      const discountFactor = 1 - (preset.rabatt_prozent || 0) / 100;
      setActiveSettings({
        ...settings,
        setup_pauschale: preset.setup_pauschale * discountFactor,
        material_verkauf_pro_g: preset.material_verkauf_pro_g * discountFactor,
        maschinenzeit_pro_h: preset.maschinenzeit_pro_h * discountFactor,
        nachbearbeitung_pro_h: preset.nachbearbeitung_pro_h * discountFactor,
        konstruktion_pro_h: preset.konstruktion_pro_h * discountFactor,
        material_einkauf_pro_kg: preset.material_einkauf_pro_kg,
        strom_verschleiss_pro_h: preset.strom_verschleiss_pro_h,
        skalierungsziel: settings.skalierungsziel,
        investitions_fonds_prozent: settings.investitions_fonds_prozent,
      });
    }
  };

  // Aufschlag-Faktor: Verkaufspreis = Einkaufspreis * Aufschlag (Standard 3×)
  const MATERIAL_AUFSCHLAG = 3.0;

  const recalcPart = (part: PartRow): PartRow => {
    // Überschreibe material_verkauf_pro_g wenn individueller Filamentpreis vorhanden
    const settingsForPart = part.filament_einkauf_pro_kg != null
      ? {
          ...activeSettings,
          material_einkauf_pro_kg: part.filament_einkauf_pro_kg,
          material_verkauf_pro_g: (part.filament_einkauf_pro_kg / 1000) * MATERIAL_AUFSCHLAG,
        }
      : activeSettings;
    const preis_pro_stueck = calcUmsatz(settingsForPart, part.gewicht_g, part.druckzeit_h, part.nachbearbeitung_h, part.konstruktion_h);
    return { ...part, preis_pro_stueck, preis_total: preis_pro_stueck * part.menge };
  };

  const updatePart = (idx: number, field: keyof PartRow, value: string | number) => {
    setParts(prev => {
      const updated = [...prev];
      const part = { ...updated[idx], [field]: value };
      updated[idx] = recalcPart(part);
      return updated;
    });
  };

  // Alle Teile neu kalkulieren wenn sich activeSettings ändert (Preset-Wechsel)
  useEffect(() => {
    setParts(prev => prev.map(p => recalcPart(p)));
  }, [activeSettings]);

  const addPart = () => setParts(prev => [...prev, emptyPart()]);
  const removePart = (idx: number) => setParts(prev => prev.filter((_, i) => i !== idx));

  // Totals
  const totalUmsatz = parts.reduce((s, p) => s + p.preis_total, 0);
  const totalKosten = parts.reduce((s, p) => {
    const einkauf = p.filament_einkauf_pro_kg ?? activeSettings.material_einkauf_pro_kg;
    const partSettings = { ...activeSettings, material_einkauf_pro_kg: einkauf };
    return s + calcKosten(partSettings, p.gewicht_g, p.druckzeit_h) * p.menge;
  }, 0);
  const totalGewinn = calcGewinn(totalUmsatz, totalKosten);
  const totalMarge = calcMarge(totalGewinn, totalUmsatz);

  const setupKosten = activeSettings.setup_pauschale;
  const matKosten = parts.reduce((s, p) => s + p.gewicht_g * activeSettings.material_verkauf_pro_g * p.menge, 0);
  const maschKosten = parts.reduce((s, p) => s + p.druckzeit_h * activeSettings.maschinenzeit_pro_h * p.menge, 0);
  const nbKosten = parts.reduce((s, p) => s + p.nachbearbeitung_h * activeSettings.nachbearbeitung_pro_h * p.menge, 0);
  const konstrKosten = parts.reduce((s, p) => s + p.konstruktion_h * activeSettings.konstruktion_pro_h * p.menge, 0);

  const handleExportPDF = async () => {
    let customerName = "Kein Kunde";
    let customerFirma, customerEmail, customerTelefon, customerAdresse;
    if (customerId) {
      const { data: c } = await supabase.from("customers").select("*").eq("id", customerId).single();
      if (c) {
        customerName = c.name;
        customerFirma = c.firma ?? undefined;
        customerEmail = c.email ?? undefined;
        customerTelefon = c.telefon ?? undefined;
        customerAdresse = c.adresse ?? undefined;
      }
    }
    exportOrderPDF({
      orderId: id || "neu",
      datum,
      beschreibung,
      status,
      customerName,
      customerFirma,
      customerEmail,
      customerTelefon,
      customerAdresse,
      parts,
      umsatz_total: totalUmsatz,
      kosten_total: totalKosten,
      gewinn_total: totalGewinn,
      marge: totalMarge,
      settings: activeSettings,
      company,
    });
  };

  const handleExportOffer = async () => {
    let customerName = "Kein Kunde";
    let customerFirma, customerEmail, customerTelefon, customerAdresse;
    if (customerId) {
      const { data: c } = await supabase.from("customers").select("*").eq("id", customerId).single();
      if (c) {
        customerName = c.name;
        customerFirma = c.firma ?? undefined;
        customerEmail = c.email ?? undefined;
        customerTelefon = c.telefon ?? undefined;
        customerAdresse = c.adresse ?? undefined;
      }
    }
    exportOfferPDF({
      orderId: id || "neu",
      datum,
      beschreibung,
      customerName,
      customerFirma,
      customerEmail,
      customerTelefon,
      customerAdresse,
      parts,
      umsatz_total: totalUmsatz,
      settings: activeSettings,
      company,
    });
  };

  const handleSave = async () => {
    setSaving(true);
    const orderData = {
      customer_id: customerId || null,
      beschreibung,
      datum,
      status,
      umsatz_total: totalUmsatz,
      kosten_total: totalKosten,
      gewinn_total: totalGewinn,
      marge: totalMarge,
    };

    let orderId = id === "neu" ? null : id;

    if (isNew) {
      const { data } = await supabase.from("orders").insert(orderData).select().single();
      orderId = data?.id;
    } else {
      await supabase.from("orders").update(orderData).eq("id", id!);
      await supabase.from("parts").delete().eq("order_id", id!);
    }

    if (orderId) {
      const partsData = parts.map(p => ({
        order_id: orderId,
        customer_id: customerId || null,
        teilname: p.teilname,
        material: p.material,
        menge: p.menge,
        gewicht_g: p.gewicht_g,
        druckzeit_h: p.druckzeit_h,
        nachbearbeitung_h: p.nachbearbeitung_h,
        konstruktion_h: p.konstruktion_h,
        preis_pro_stueck: p.preis_pro_stueck,
        preis_total: p.preis_total,
        status: p.status,
        notizen: p.notizen,
      }));
      await supabase.from("parts").insert(partsData);
    }

    setSaving(false);
    navigate(isNew ? `/auftraege/${orderId}` : `/auftraege/${id}`, { replace: true });
    if (!isNew) window.location.reload();
  };

  if (loading) return <div className="p-8 text-muted-foreground">Laden...</div>;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate("/auftraege")} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold flex-1">{isNew ? "Neuer Auftrag" : `Auftrag bearbeiten`}</h1>
        {!isNew && (
          <>
            <Button onClick={handleExportPDF} variant="outline" className="gap-2 border-border">
              <FileDown className="w-4 h-4" />
              Rechnung
            </Button>
            <Button onClick={handleExportOffer} variant="outline" className="gap-2 border-border">
              <FileDown className="w-4 h-4" />
              Offerte
            </Button>
          </>
        )}
        <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 gap-2">
          <Save className="w-4 h-4" />
          {saving ? "Speichern..." : "Speichern"}
        </Button>
      </div>

      {/* Basic info */}
      <div className="bg-card border border-border rounded-lg p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="col-span-2 space-y-1.5">
            <Label>Kunde</Label>
            <select
              value={customerId}
              onChange={e => setCustomerId(e.target.value)}
              className="w-full h-9 px-3 rounded-md bg-input border border-border text-sm text-foreground"
            >
              <option value="">— Kein Kunde —</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Datum</Label>
            <Input type="date" value={datum} onChange={e => setDatum(e.target.value)} className="bg-input border-border" />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="w-full h-9 px-3 rounded-md bg-input border border-border text-sm text-foreground"
            >
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="col-span-2 md:col-span-4 space-y-1.5">
            <Label>Beschreibung</Label>
            <Textarea value={beschreibung} onChange={e => setBeschreibung(e.target.value)} className="bg-input border-border" rows={2} />
          </div>
        </div>
      </div>

      {/* Parts table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-sm">Teile</h2>
          <div className="flex items-center gap-2">
            {presets.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                <select
                  value={selectedPresetId}
                  onChange={e => handlePresetChange(e.target.value)}
                  className="h-7 px-2 rounded bg-input border border-border text-xs text-foreground"
                >
                  <option value="">— Standard-Sätze —</option>
                  {presets.map(p => (
                    <option key={p.id} value={p.id}>{p.name}{p.rabatt_prozent > 0 ? ` (-${p.rabatt_prozent}%)` : ""}</option>
                  ))}
                </select>
              </div>
            )}
            <Button onClick={addPart} variant="outline" size="sm" className="gap-1.5 border-border text-xs">
              <Plus className="w-3.5 h-3.5" />Teil hinzufügen
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[900px]">
            <thead>
              <tr className="border-b border-border">
                {["Teilname", "Filament / Material", "Menge", "Gewicht(g)", "Druck(h)", "NB(h)", "Konstr(h)", "Preis/St.", "Total", "Status", "Notizen", ""].map(h => (
                  <th key={h} className="px-3 py-2.5 text-muted-foreground font-medium text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parts.map((part, idx) => (
                <React.Fragment key={idx}>
                  <tr className="border-b border-border/50 hover:bg-muted/20">
                    <td className="px-2 py-2">
                      <Input value={part.teilname} onChange={e => updatePart(idx, "teilname", e.target.value)} className="bg-input border-border h-7 text-xs w-28" placeholder="Name" />
                    </td>
                    <td className="px-2 py-2 min-w-[160px]">
                      {filaments.length > 0 ? (
                        <div className="space-y-0.5">
                          <select
                            value={part.filament_id || ""}
                            onChange={e => {
                              const fil = filaments.find(f => f.id === e.target.value);
                              setParts(prev => {
                                const updated = [...prev];
                                const p = {
                                  ...updated[idx],
                                  filament_id: e.target.value,
                                  filament_einkauf_pro_kg: fil ? fil.preis_pro_kg : undefined,
                                  material: fil ? `${fil.material} – ${fil.name}` : updated[idx].material,
                                };
                                updated[idx] = recalcPart(p);
                                return updated;
                              });
                            }}
                            className="h-7 px-2 rounded bg-input border border-border text-xs text-foreground w-full"
                          >
                            <option value="">Manuell eingeben…</option>
                            {filaments.map(f => (
                              <option key={f.id} value={f.id}>
                                {f.material} – {f.name}{f.farbe ? ` (${f.farbe})` : ""} · CHF {f.preis_pro_kg}/kg
                              </option>
                            ))}
                          </select>
                          {part.filament_einkauf_pro_kg != null && (
                            <div className="text-[10px] text-muted-foreground px-0.5">
                              Einkauf: CHF {part.filament_einkauf_pro_kg}/kg → Verkauf: CHF {((part.filament_einkauf_pro_kg / 1000) * MATERIAL_AUFSCHLAG).toFixed(3)}/g
                            </div>
                          )}
                        </div>
                      ) : (
                        <select value={part.material} onChange={e => updatePart(idx, "material", e.target.value)} className="h-7 px-2 rounded bg-input border border-border text-xs text-foreground">
                          {FALLBACK_MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <Input type="number" value={part.menge} onChange={e => updatePart(idx, "menge", parseFloat(e.target.value) || 0)} className="bg-input border-border h-7 text-xs w-16" />
                    </td>
                    <td className="px-2 py-2">
                      <Input type="number" value={part.gewicht_g} onChange={e => updatePart(idx, "gewicht_g", parseFloat(e.target.value) || 0)} className="bg-input border-border h-7 text-xs w-20" step="0.1" />
                    </td>
                    <td className="px-2 py-2">
                      <Input type="number" value={part.druckzeit_h} onChange={e => updatePart(idx, "druckzeit_h", parseFloat(e.target.value) || 0)} className="bg-input border-border h-7 text-xs w-20" step="0.1" />
                    </td>
                    <td className="px-2 py-2">
                      <Input type="number" value={part.nachbearbeitung_h} onChange={e => updatePart(idx, "nachbearbeitung_h", parseFloat(e.target.value) || 0)} className="bg-input border-border h-7 text-xs w-20" step="0.1" />
                    </td>
                    <td className="px-2 py-2">
                      <Input type="number" value={part.konstruktion_h} onChange={e => updatePart(idx, "konstruktion_h", parseFloat(e.target.value) || 0)} className="bg-input border-border h-7 text-xs w-20" step="0.1" />
                    </td>
                    <td className="px-2 py-2 text-right font-medium text-primary whitespace-nowrap">{formatCHF(part.preis_pro_stueck)}</td>
                    <td className="px-2 py-2 text-right font-medium whitespace-nowrap">{formatCHF(part.preis_total)}</td>
                    <td className="px-2 py-2">
                      <select value={part.status} onChange={e => updatePart(idx, "status", e.target.value)} className="h-7 px-2 rounded bg-input border border-border text-xs text-foreground">
                        {PART_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <Input value={part.notizen} onChange={e => updatePart(idx, "notizen", e.target.value)} className="bg-input border-border h-7 text-xs w-24" placeholder="Notiz" />
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1">
                        {part.id && (
                          <button
                            onClick={() => setExpandedPartIdx(expandedPartIdx === idx ? null : idx)}
                            title="Dateien"
                            className={`transition-colors p-1 ${expandedPartIdx === idx ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                          >
                            <Paperclip className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button onClick={() => removePart(idx)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {/* File upload row – only for saved parts */}
                  {expandedPartIdx === idx && part.id && (
                    <tr className="bg-muted/10 border-b border-border/50">
                      <td colSpan={12} className="px-4 py-3">
                        <PartFileUpload
                          partId={part.id}
                          orderId={typeof id === "string" && id !== "neu" ? id : undefined}
                          customerId={customerId || undefined}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Status Workflow – nur für gespeicherte Aufträge */}
      {!isNew && (
        <OrderStatusWorkflow
          orderId={id!}
          currentStatus={status}
          onStatusChange={setStatus}
        />
      )}

      {/* Summary */}
      <div className="bg-card border border-border rounded-lg p-5 max-w-xs ml-auto">
        <h3 className="font-semibold text-sm mb-3">Auftrags-Zusammenfassung</h3>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Setup-Pauschale</span>
            <span>{formatCHF(setupKosten)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Material</span>
            <span>{formatCHF(matKosten)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Maschinenzeit</span>
            <span>{formatCHF(maschKosten)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Nachbearbeitung</span>
            <span>{formatCHF(nbKosten)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Konstruktion</span>
            <span>{formatCHF(konstrKosten)}</span>
          </div>
          <div className="border-t border-border my-2" />
          <div className="flex justify-between font-bold">
            <span>Total Umsatz</span>
            <span className="text-primary">{formatCHF(totalUmsatz)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Meine Kosten</span>
            <span className="text-destructive">{formatCHF(totalKosten)}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>Reingewinn</span>
            <span className="text-success">{formatCHF(totalGewinn)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Marge</span>
            <span>{formatPct(totalMarge)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
