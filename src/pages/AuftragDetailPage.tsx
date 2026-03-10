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
import { ArrowLeft, Plus, Trash2, Save, FileDown, Tag, Paperclip, Mail, Loader2, MoreVertical, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { exportOrderPDF } from "@/lib/pdfExport";
import { exportOfferPDF, exportAuftragsbestaetiguungPDF } from "@/lib/pdfOfferExport";
import { exportAkontoPDF, exportRestbetragPDF } from "@/lib/pdfAkontoExport";
import { useCompanySettings } from "@/contexts/CompanySettingsContext";
import PartFileUpload from "@/components/PartFileUpload";
import type { Filament } from "@/pages/FilamentePage";
import OrderStatusWorkflow from "@/components/OrderStatusWorkflow";
import TimeTracker from "@/components/TimeTracker";
import OfferMode from "@/components/OfferMode";
import BillsSection from "@/components/BillsSection";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PartRow {
  id?: string;
  teilname: string;
  material: string;
  filament_id?: string;
  filament_einkauf_pro_kg?: number; // individueller Filamentpreis
  filament_verkauf_pro_g?: number | null; // manuell gesetzter Verkaufspreis (überschreibt Auto-Berechnung)
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
  const isMobile = useIsMobile();
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
  const [orderName, setOrderName] = useState("");
  const [beschreibung, setBeschreibung] = useState("");
  const [datum, setDatum] = useState(new Date().toISOString().split("T")[0]);
  const [status, setStatus] = useState("Offen");
  const [trackingNr, setTrackingNr] = useState("");
  const [geplantVon, setGeplantVon] = useState("");
  const [geplantBis, setGeplantBis] = useState("");
  const [confirmEmailType, setConfirmEmailType] = useState<"rechnung" | "offerte" | "lieferung" | "auftragsbestaetigung" | "druckfertig" | null>(null);
  const [withDetails, setWithDetails] = useState(false);
  const [withPaymentLink, setWithPaymentLink] = useState(false);
  const [showAkontoDialog, setShowAkontoDialog] = useState(false);
  const [akontoPercent, setAkontoPercent] = useState(50);
  const [akontoMode, setAkontoMode] = useState<"akonto" | "restbetrag">("akonto");
  const [sendingAkonto, setSendingAkonto] = useState(false);
  const [parts, setParts] = useState<PartRow[]>([emptyPart()]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { toast } = useToast();

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
        const [{ data: o }, { data: p }, { data: presetData }] = await Promise.all([
          supabase.from("orders").select("*").eq("id", id!).single(),
          supabase.from("parts").select("*").eq("order_id", id!),
          supabase.from("price_presets").select("*").order("created_at"),
        ]);
        const loadedPresets = (presetData || []) as Preset[];
        if (o) {
          setOrderName((o as any).name || "");
          setCustomerId(o.customer_id || "");
          setBeschreibung(o.beschreibung || "");
          setDatum(o.datum);
          setStatus(o.status);
          setTrackingNr((o as any).tracking_nr || "");
          setGeplantVon((o as any).geplant_von || "");
          setGeplantBis((o as any).geplant_bis || "");
          // Restore preset if saved
          const savedPresetId = (o as any).preset_id;
          if (savedPresetId) {
            setSelectedPresetId(savedPresetId);
            const preset = loadedPresets.find(pr => pr.id === savedPresetId);
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
          }
        }
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
    // Wenn manueller Verkaufspreis am Filament hinterlegt → direkt nutzen
    // Sonst: wenn Einkaufspreis vorhanden → Auto × 3, sonst Preset-Setting
    let effectiveVerkaufProG = activeSettings.material_verkauf_pro_g;
    if (part.filament_verkauf_pro_g != null) {
      effectiveVerkaufProG = part.filament_verkauf_pro_g;
    } else if (part.filament_einkauf_pro_kg != null) {
      effectiveVerkaufProG = (part.filament_einkauf_pro_kg / 1000) * MATERIAL_AUFSCHLAG;
    }
    const settingsForPart = {
      ...activeSettings,
      material_einkauf_pro_kg: part.filament_einkauf_pro_kg ?? activeSettings.material_einkauf_pro_kg,
      material_verkauf_pro_g: effectiveVerkaufProG,
    };
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

  const addPart = async () => {
    const newPart = emptyPart();
    if (!isNew && id) {
      // Insert immediately so the part gets an ID → file upload works right away
      const { data } = await supabase.from("parts").insert({
        order_id: id,
        customer_id: customerId || null,
        teilname: newPart.teilname || "Neues Teil",
        material: newPart.material,
        menge: newPart.menge,
        gewicht_g: newPart.gewicht_g,
        druckzeit_h: newPart.druckzeit_h,
        nachbearbeitung_h: newPart.nachbearbeitung_h,
        konstruktion_h: newPart.konstruktion_h,
        preis_pro_stueck: newPart.preis_pro_stueck,
        preis_total: newPart.preis_total,
        status: newPart.status,
        notizen: newPart.notizen,
      }).select().single();
      if (data) {
        const inserted = { ...newPart, id: data.id };
        setParts(prev => [...prev, inserted]);
        setExpandedPartIdx(null); // close any open upload row
        return;
      }
    }
    setParts(prev => [...prev, newPart]);
  };
  const removePart = (idx: number) => setParts(prev => prev.filter((_, i) => i !== idx));

  const handleDeleteOrder = async () => {
    if (!id || isNew) return;
    await supabase.from("part_files").delete().eq("order_id", id);
    await supabase.from("parts").delete().eq("order_id", id);
    await supabase.from("order_status_log").delete().eq("order_id", id);
    await supabase.from("orders").delete().eq("id", id);
    toast({ title: "Auftrag gelöscht" });
    navigate("/auftraege");
  };

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

  const handleSendEmail = async (type: "rechnung" | "offerte" | "lieferung" | "auftragsbestaetigung" | "druckfertig") => {
    setSendingEmail(type);
    try {
      let pdfBase64: string | null = null;
      let pdfFilename: string | null = null;
      let paymentUrl: string | null = null;

      if (type === "rechnung" || type === "offerte") {
        const { customerName, customerFirma, customerEmail, customerTelefon, customerAdresse } = await getCustomerData();
        if (type === "rechnung") {
          // Optionally generate Stripe payment link
          if (withPaymentLink && totalUmsatz > 0) {
            try {
              const { data: plData, error: plErr } = await supabase.functions.invoke("create-stripe-payment-link", {
                body: { orderId: id, betrag: totalUmsatz, orderName, customerEmail },
              });
              if (plErr || plData?.error) {
                setSendingEmail(null);
                toast({ title: "Stripe Fehler", description: plData?.error || plErr?.message || "Zahlungslink konnte nicht erstellt werden.", variant: "destructive" });
                return;
              }
              if (plData?.url) paymentUrl = plData.url;
            } catch (e) {
              setSendingEmail(null);
              toast({ title: "Stripe Fehler", description: "Zahlungslink konnte nicht erstellt werden.", variant: "destructive" });
              return;
            }
          }
          const result = await exportOrderPDF({
            orderId: id || "neu", datum, beschreibung, status,
            customerName, customerFirma, customerEmail, customerTelefon, customerAdresse,
            parts, umsatz_total: totalUmsatz, kosten_total: totalKosten,
            gewinn_total: totalGewinn, marge: totalMarge,
            settings: activeSettings, company, returnBase64: true, withDetails,
          });
          if (result) { pdfBase64 = result.base64; pdfFilename = result.filename; }
        } else {
          const result = await exportOfferPDF({
            orderId: id || "neu", datum, beschreibung,
            customerName, customerFirma, customerEmail, customerTelefon, customerAdresse,
            parts, umsatz_total: totalUmsatz, settings: activeSettings, company, returnBase64: true, withDetails,
          });
          if (result) { pdfBase64 = result.base64; pdfFilename = result.filename; }
        }
      }

      const { data, error } = await supabase.functions.invoke("send-order-email", {
        body: { orderId: id, type, trackingNr, pdfBase64, pdfFilename, paymentUrl },
      });
      if (error || data?.error) {
        toast({ title: "Fehler", description: data?.error || error?.message, variant: "destructive" });
      } else {
        const labels: Record<string, string> = { rechnung: "Rechnung", offerte: "Offerte", lieferung: "Lieferbenachrichtigung", auftragsbestaetigung: "Auftragsbestätigung", druckfertig: "Druckfertig-Info" };
        toast({ title: "E-Mail gesendet ✓", description: `${labels[type]} wurde erfolgreich versandt.` });
      }
    } catch (e: any) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    }
    setSendingEmail(null);
  };

  const getCustomerData = async () => {
    let customerName = "Kein Kunde";
    let customerFirma: string | undefined, customerEmail: string | undefined, customerTelefon: string | undefined, customerAdresse: string | undefined;
    if (customerId) {
      const { data: c } = await supabase.from("customers").select("*").eq("id", customerId).single();
      if (c) {
        customerName = [c.vorname, c.name].filter(Boolean).join(" ") || c.name;
        customerFirma = c.firma ?? undefined;
        customerEmail = c.email ?? undefined;
        customerTelefon = c.telefon ?? undefined;
        const adresseParts: string[] = [];
        if (c.strasse || c.hausnummer) adresseParts.push(`${c.strasse || ""} ${c.hausnummer || ""}`.trim());
        if (c.plz || c.ort) adresseParts.push(`${c.plz || ""} ${c.ort || ""}`.trim());
        customerAdresse = adresseParts.length ? adresseParts.join("\n") : (c.adresse || undefined);
      }
    }
    return { customerName, customerFirma, customerEmail, customerTelefon, customerAdresse };
  };

  const handleExportAkonto = async (download = true) => {
    setSendingAkonto(true);
    try {
      const { customerName, customerFirma, customerEmail, customerTelefon, customerAdresse } = await getCustomerData();
      const akontoBetrag = Math.round(totalUmsatz * akontoPercent) / 100;
      const result = await exportAkontoPDF({
        orderId: id || "neu", datum, beschreibung, status,
        customerName, customerFirma, customerEmail, customerTelefon, customerAdresse,
        parts, umsatz_total: totalUmsatz, akontoPercent, akontoBetrag,
        settings: activeSettings, company, returnBase64: !download,
      });
      if (!download && result) {
        // Send via email
        const { data, error } = await supabase.functions.invoke("send-order-email", {
          body: { orderId: id, type: "akonto", pdfBase64: result.base64, pdfFilename: result.filename, akontoPercent, akontoBetrag },
        });
        if (error || data?.error) {
          toast({ title: "Fehler", description: data?.error || error?.message, variant: "destructive" });
        } else {
          toast({ title: "Akontorechnung gesendet ✓", description: `${akontoPercent}% (${formatCHF(akontoBetrag)}) wurde per E-Mail versandt.` });
        }
      }
      setShowAkontoDialog(false);
    } catch (e: any) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    }
    setSendingAkonto(false);
  };

  const handleExportRestbetrag = async (download = true) => {
    setSendingAkonto(true);
    try {
      const { customerName, customerFirma, customerEmail, customerTelefon, customerAdresse } = await getCustomerData();
      const akontoBetrag = Math.round(totalUmsatz * akontoPercent) / 100;
      const restbetrag = totalUmsatz - akontoBetrag;
      const result = await exportRestbetragPDF({
        orderId: id || "neu", datum, beschreibung, status,
        customerName, customerFirma, customerEmail, customerTelefon, customerAdresse,
        parts, umsatz_total: totalUmsatz, akontoPercent, akontoBetrag, restbetrag,
        settings: activeSettings, company, returnBase64: !download,
      });
      if (!download && result) {
        const { data, error } = await supabase.functions.invoke("send-order-email", {
          body: { orderId: id, type: "restbetrag", pdfBase64: result.base64, pdfFilename: result.filename, akontoPercent, akontoBetrag, restbetrag },
        });
        if (error || data?.error) {
          toast({ title: "Fehler", description: data?.error || error?.message, variant: "destructive" });
        } else {
          toast({ title: "Schlussrechnung gesendet ✓", description: `Restbetrag ${formatCHF(restbetrag)} wurde per E-Mail versandt.` });
        }
      }
      setShowAkontoDialog(false);
    } catch (e: any) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    }
    setSendingAkonto(false);
  };

  const handleExportPDF = async (details = false) => {
    const { customerName, customerFirma, customerEmail, customerTelefon, customerAdresse } = await getCustomerData();
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
      withDetails: details,
    });
  };

  const handleExportOffer = async (details = false) => {
    const { customerName, customerFirma, customerEmail, customerTelefon, customerAdresse } = await getCustomerData();
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
      withDetails: details,
    });
  };

  const handleExportAuftragsbestaetigung = async () => {
    const { customerName, customerFirma, customerEmail, customerTelefon, customerAdresse } = await getCustomerData();
    exportAuftragsbestaetiguungPDF({
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
    const orderData: Record<string, any> = {
      name: orderName || null,
      customer_id: customerId || null,
      beschreibung,
      datum,
      status,
      umsatz_total: totalUmsatz,
      kosten_total: totalKosten,
      gewinn_total: totalGewinn,
      marge: totalMarge,
      geplant_von: geplantVon || null,
      geplant_bis: geplantBis || null,
      preset_id: selectedPresetId || null,
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
        filament_id: p.filament_id || null,
        filament_einkauf_pro_kg: p.filament_einkauf_pro_kg ?? null,
      }));
      await supabase.from("parts").insert(partsData);
    }

    setSaving(false);
    if (isNew) {
      navigate(`/auftraege/${orderId}`, { replace: true });
    } else {
      // Reload parts from DB to sync IDs, without losing local UI state
      const { data: freshParts } = await supabase.from("parts").select("*").eq("order_id", id!);
      if (freshParts) setParts(freshParts as PartRow[]);
      toast({ title: "Gespeichert ✓" });
    }
  };

  if (loading) return <div className="p-8 text-muted-foreground">Laden...</div>;

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-2 md:gap-4">
        <button onClick={() => navigate("/auftraege")} className="text-muted-foreground hover:text-foreground transition-colors p-1 shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg md:text-2xl font-bold flex-1 min-w-0 truncate">{isNew ? "Neuer Auftrag" : "Auftrag bearbeiten"}</h1>

        {/* Mobile: nur Speichern + Mehr-Menü */}
        {isMobile ? (
          <div className="flex items-center gap-2 shrink-0">
            <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 gap-1.5" size="sm">
              <Save className="w-3.5 h-3.5" />
              {saving ? "..." : "Speichern"}
            </Button>
            {!isNew && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="px-2 border-border">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onClick={() => handleExportPDF(false)} className="gap-2">
                    <FileDown className="w-4 h-4" /> Rechnung PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExportPDF(true)} className="gap-2">
                    <FileDown className="w-4 h-4" /> Rechnung PDF (Details)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setConfirmEmailType("rechnung")} disabled={!!sendingEmail} className="gap-2">
                    {sendingEmail === "rechnung" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} Rechnung mailen
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExportOffer(false)} className="gap-2">
                    <FileDown className="w-4 h-4" /> Offerte PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExportOffer(true)} className="gap-2">
                    <FileDown className="w-4 h-4" /> Offerte PDF (Details)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setConfirmEmailType("offerte")} disabled={!!sendingEmail} className="gap-2">
                    {sendingEmail === "offerte" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} Offerte mailen
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExportAuftragsbestaetigung()} className="gap-2">
                    <FileDown className="w-4 h-4" /> Auftragsbestätigung PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setConfirmEmailType("auftragsbestaetigung")} disabled={!!sendingEmail} className="gap-2 text-primary">
                    {sendingEmail === "auftragsbestaetigung" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} Auftragsbestätigung mailen
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowAkontoDialog(true)} className="gap-2 text-primary">
                    <FileDown className="w-4 h-4" /> Akontorechnung
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setConfirmEmailType("druckfertig")} disabled={!!sendingEmail} className="gap-2 text-warning focus:text-warning">
                    {sendingEmail === "druckfertig" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} Druckfertig-Mail
                  </DropdownMenuItem>
                  {(status === "Geliefert" || status === "Bezahlt" || status === "Abgeschlossen" || trackingNr) && (
                    <DropdownMenuItem onClick={() => setConfirmEmailType("lieferung")} disabled={!!sendingEmail} className="gap-2 text-success">
                      {sendingEmail === "lieferung" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                      {trackingNr ? "Update-Mail" : "Lieferung mailen"}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="gap-2 text-destructive focus:text-destructive">
                    <Trash2 className="w-4 h-4" /> Löschen
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        ) : (
          /* Desktop: gruppierte Dropdown-Menüs */
          <div className="flex items-center gap-2 shrink-0">
            {!isNew && (
              <>
                {/* PDF herunterladen */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-2 border-border">
                      <FileDown className="w-4 h-4" /> PDF <ChevronDown className="w-3.5 h-3.5 ml-1 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={() => handleExportPDF(false)} className="gap-2">
                      <FileDown className="w-4 h-4" /> Rechnung
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExportPDF(true)} className="gap-2">
                      <FileDown className="w-4 h-4" /> Rechnung (Details)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExportOffer(false)} className="gap-2">
                      <FileDown className="w-4 h-4" /> Offerte
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExportOffer(true)} className="gap-2">
                      <FileDown className="w-4 h-4" /> Offerte (Details)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExportAuftragsbestaetigung()} className="gap-2">
                      <FileDown className="w-4 h-4" /> Auftragsbestätigung
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowAkontoDialog(true)} className="gap-2 text-primary">
                      <FileDown className="w-4 h-4" /> Akontorechnung
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* E-Mail senden */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-2 border-border" disabled={!!sendingEmail}>
                      {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                      E-Mail <ChevronDown className="w-3.5 h-3.5 ml-1 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem onClick={() => setConfirmEmailType("rechnung")} className="gap-2">
                      <Mail className="w-4 h-4" /> Rechnung senden
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setConfirmEmailType("offerte")} className="gap-2">
                      <Mail className="w-4 h-4" /> Offerte senden
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setConfirmEmailType("auftragsbestaetigung")} className="gap-2 text-primary">
                      <Mail className="w-4 h-4" /> Auftragsbestätigung
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setConfirmEmailType("druckfertig")} className="gap-2 text-warning focus:text-warning">
                      <Mail className="w-4 h-4" /> Druckfertig-Info senden
                    </DropdownMenuItem>
                    {(status === "Geliefert" || status === "Bezahlt" || status === "Abgeschlossen" || trackingNr) && (
                      <DropdownMenuItem onClick={() => setConfirmEmailType("lieferung")} className="gap-2 text-success focus:text-success">
                        <Mail className="w-4 h-4" />
                        {trackingNr ? "Update-Mail senden" : "Lieferung senden"}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button onClick={() => setShowDeleteDialog(true)} variant="outline" className="gap-2 border-destructive/50 text-destructive hover:bg-destructive/10">
                  <Trash2 className="w-4 h-4" /> Löschen
                </Button>
              </>
            )}
            <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 gap-2">
              <Save className="w-4 h-4" />
              {saving ? "Speichern..." : "Speichern"}
            </Button>
          </div>
        )}
      </div>

      {/* E-Mail Bestätigungsdialog */}
      <AlertDialog open={!!confirmEmailType} onOpenChange={(open) => { if (!open) { setConfirmEmailType(null); setWithDetails(false); setWithPaymentLink(false); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>E-Mail wirklich senden?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmEmailType === "rechnung" && "Die Rechnung wird als PDF per E-Mail an den Kunden gesendet."}
              {confirmEmailType === "offerte" && "Die Offerte wird als PDF per E-Mail an den Kunden gesendet."}
              {confirmEmailType === "auftragsbestaetigung" && "Eine Auftragsbestätigung wird per E-Mail an den Kunden gesendet."}
              {confirmEmailType === "lieferung" && "Eine Lieferungsbenachrichtigung wird per E-Mail an den Kunden gesendet."}
              {confirmEmailType === "druckfertig" && "Der Kunde wird per E-Mail informiert, dass seine 3D-Druckteile fertig gedruckt sind und bald versendet werden."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {(confirmEmailType === "rechnung" || confirmEmailType === "offerte") && (
            <div className="space-y-2 py-1">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={withDetails}
                  onChange={e => setWithDetails(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <span>Mit Details <span className="text-muted-foreground text-xs">(Gewicht, Druckzeit, Konstruktion, Nachbearbeitung)</span></span>
              </label>
              {confirmEmailType === "rechnung" && totalUmsatz > 0 && (
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={withPaymentLink}
                    onChange={e => setWithPaymentLink(e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  <span>
                    💳 Stripe Zahlungslink hinzufügen{" "}
                    <span className="text-muted-foreground text-xs">(CHF {totalUmsatz.toFixed(2)} – Kunde kann online bezahlen)</span>
                  </span>
                </label>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmEmailType) { handleSendEmail(confirmEmailType); setConfirmEmailType(null); } }}>
              Ja, senden
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Akontorechnung Dialog */}
      <AlertDialog open={showAkontoDialog} onOpenChange={(open) => { if (!open) { setShowAkontoDialog(false); setAkontoMode("akonto"); } }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Teilrechnung / Schlussrechnung</AlertDialogTitle>
            <AlertDialogDescription>
              Gesamtbetrag: <strong>{formatCHF(totalUmsatz)}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            {/* Mode Toggle */}
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setAkontoMode("akonto")}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${akontoMode === "akonto" ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/60"}`}
              >
                Akontorechnung
              </button>
              <button
                onClick={() => setAkontoMode("restbetrag")}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${akontoMode === "restbetrag" ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/60"}`}
              >
                Schlussrechnung
              </button>
            </div>

            {/* Percent slider — shared for both modes */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {akontoMode === "akonto" ? "Akontozahlung in %" : "Bereits bezahlter Akonto in %"}
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range" min={5} max={95} step={5}
                  value={akontoPercent}
                  onChange={e => setAkontoPercent(Number(e.target.value))}
                  className="flex-1 accent-primary"
                />
                <div className="flex items-center gap-1 shrink-0">
                  <Input
                    type="number" min={1} max={99}
                    value={akontoPercent}
                    onChange={e => setAkontoPercent(Math.min(99, Math.max(1, Number(e.target.value))))}
                    className="w-16 h-8 text-sm text-center"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap mt-1">
                {[25, 33, 50, 66, 75].map(p => (
                  <button key={p} onClick={() => setAkontoPercent(p)}
                    className={`text-xs px-2 py-1 rounded border transition-colors ${akontoPercent === p ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary"}`}>
                    {p}%
                  </button>
                ))}
              </div>
            </div>

            {/* Summary box */}
            <div className="bg-muted/30 border border-border rounded-lg p-3 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Gesamtbetrag</span>
                <span>{formatCHF(totalUmsatz)}</span>
              </div>
              {akontoMode === "akonto" ? (
                <>
                  <div className="flex justify-between text-sm font-semibold text-primary">
                    <span>Akontozahlung ({akontoPercent}%)</span>
                    <span>{formatCHF(Math.round(totalUmsatz * akontoPercent) / 100)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground border-t border-border pt-1.5">
                    <span>Verbleibender Restbetrag</span>
                    <span>{formatCHF(totalUmsatz - Math.round(totalUmsatz * akontoPercent) / 100)}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Abzüglich Akonto ({akontoPercent}%)</span>
                    <span>- {formatCHF(Math.round(totalUmsatz * akontoPercent) / 100)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold text-primary border-t border-border pt-1.5">
                    <span>Restbetrag (fällig)</span>
                    <span>{formatCHF(totalUmsatz - Math.round(totalUmsatz * akontoPercent) / 100)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <div className="flex gap-2">
              <Button
                onClick={() => akontoMode === "akonto" ? handleExportAkonto(true) : handleExportRestbetrag(true)}
                disabled={sendingAkonto} variant="outline" className="flex-1 gap-2 border-border">
                {sendingAkonto ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                PDF herunterladen
              </Button>
              <Button
                onClick={() => akontoMode === "akonto" ? handleExportAkonto(false) : handleExportRestbetrag(false)}
                disabled={sendingAkonto} className="flex-1 gap-2">
                {sendingAkonto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                Per E-Mail senden
              </Button>
            </div>
            <AlertDialogCancel disabled={sendingAkonto} className="w-full">Abbrechen</AlertDialogCancel>
          </div>
        </AlertDialogContent>

      </AlertDialog>

      {/* Basic info */}
      <div className="bg-card border border-border rounded-lg p-4 md:p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-4 space-y-1.5">
            <Label>Auftragsname <span className="text-muted-foreground font-normal text-xs">(wird als E-Mail-Betreff verwendet)</span></Label>
            <Input
              value={orderName}
              onChange={e => setOrderName(e.target.value)}
              placeholder="z.B. Halterungen für Kundenanlage, Prototyp Serie A …"
              className="bg-input border-border"
            />
          </div>
          <div className="space-y-1.5">
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
            <Label>Bearbeitung von</Label>
            <Input type="date" value={geplantVon} onChange={e => setGeplantVon(e.target.value)} className="bg-input border-border" />
          </div>
          <div className="space-y-1.5">
            <Label>Bearbeitung bis</Label>
            <Input type="date" value={geplantBis} onChange={e => setGeplantBis(e.target.value)} className="bg-input border-border" />
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
          <div className="md:col-span-4 space-y-1.5">
            <Label>Beschreibung</Label>
            <Textarea value={beschreibung} onChange={e => setBeschreibung(e.target.value)} className="bg-input border-border" rows={2} />
          </div>
        </div>
      </div>

      {/* Parts */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
          <h2 className="font-semibold text-sm shrink-0">Teile</h2>
          <div className="flex items-center gap-2 min-w-0">
            {presets.length > 0 && (
              <div className="flex items-center gap-1.5 min-w-0">
                <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <select
                  value={selectedPresetId}
                  onChange={e => handlePresetChange(e.target.value)}
                  className="h-7 px-2 rounded bg-input border border-border text-xs text-foreground max-w-[130px] md:max-w-none truncate"
                >
                  <option value="">— Standard-Sätze —</option>
                  {presets.map(p => (
                    <option key={p.id} value={p.id}>{p.name}{p.rabatt_prozent > 0 ? ` (-${p.rabatt_prozent}%)` : ""}</option>
                  ))}
                </select>
              </div>
            )}
            <Button onClick={addPart} variant="outline" size="sm" className="gap-1 border-border text-xs shrink-0 px-2 md:px-3">
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Teil </span>hinzufügen
            </Button>
          </div>
        </div>

        {/* Mobile: Card je Teil */}
        {isMobile ? (
          <div className="divide-y divide-border/50">
            {parts.map((part, idx) => (
              <div key={idx} className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Input
                    value={part.teilname}
                    onChange={e => updatePart(idx, "teilname", e.target.value)}
                    className="bg-input border-border h-9 text-sm flex-1"
                    placeholder="Teilname"
                  />
                  <div className="flex gap-1 shrink-0">
                    {part.id && (
                      <button
                        onClick={() => setExpandedPartIdx(expandedPartIdx === idx ? null : idx)}
                        className={`p-2 rounded transition-colors ${expandedPartIdx === idx ? "text-primary" : "text-muted-foreground"}`}
                      >
                        <Paperclip className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => removePart(idx)} className="p-2 rounded text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Filament */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Filament / Material</label>
                  {filaments.length > 0 ? (
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
                            filament_verkauf_pro_g: fil ? (fil.verkaufspreis_pro_g ?? null) : undefined,
                            material: fil ? `${fil.material} – ${fil.name}` : updated[idx].material,
                          };
                          updated[idx] = recalcPart(p);
                          return updated;
                        });
                      }}
                      className="h-9 px-3 rounded bg-input border border-border text-sm text-foreground w-full"
                    >
                      <option value="">Manuell eingeben…</option>
                      {filaments.map(f => (
                        <option key={f.id} value={f.id}>
                          {f.material} – {f.name}{f.farbe ? ` (${f.farbe})` : ""} · CHF {f.preis_pro_kg}/kg
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select value={part.material} onChange={e => updatePart(idx, "material", e.target.value)} className="h-9 px-3 rounded bg-input border border-border text-sm text-foreground w-full">
                      {FALLBACK_MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  )}
                   {part.filament_einkauf_pro_kg != null && (
                      <div className="text-[10px] text-muted-foreground">
                        Einkauf: CHF {part.filament_einkauf_pro_kg}/kg → Verkauf:{" "}
                        {part.filament_verkauf_pro_g != null
                          ? <span className="text-primary">CHF {part.filament_verkauf_pro_g.toFixed(3)}/g (manuell)</span>
                          : `CHF ${((part.filament_einkauf_pro_kg / 1000) * MATERIAL_AUFSCHLAG).toFixed(3)}/g`
                        }
                      </div>
                    )}
                </div>

                {/* Zahlen 2-spaltig */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Menge", field: "menge" as keyof PartRow, step: "1" },
                    { label: "Gewicht (g)", field: "gewicht_g" as keyof PartRow, step: "0.1" },
                    { label: "Druckzeit (h)", field: "druckzeit_h" as keyof PartRow, step: "0.1" },
                    { label: "Nachbearb. (h)", field: "nachbearbeitung_h" as keyof PartRow, step: "0.1" },
                    { label: "Konstruktion (h)", field: "konstruktion_h" as keyof PartRow, step: "0.1" },
                  ].map(({ label, field, step }) => (
                    <div key={field} className="space-y-1">
                      <label className="text-xs text-muted-foreground">{label}</label>
                      <Input
                        type="number"
                        value={part[field] as number}
                        onChange={e => updatePart(idx, field, parseFloat(e.target.value) || 0)}
                        className="bg-input border-border h-9 text-sm"
                        step={step}
                        inputMode="decimal"
                      />
                    </div>
                  ))}
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Status</label>
                    <select value={part.status} onChange={e => updatePart(idx, "status", e.target.value)} className="h-9 px-3 rounded bg-input border border-border text-sm text-foreground w-full">
                      {PART_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Notiz</label>
                  <Input value={part.notizen} onChange={e => updatePart(idx, "notizen", e.target.value)} className="bg-input border-border h-9 text-sm w-full" placeholder="Notiz..." />
                </div>

                {/* Preisanzeige */}
                <div className="flex items-center justify-between bg-muted/20 rounded-lg px-3 py-2">
                  <span className="text-xs text-muted-foreground">Preis/Stk.</span>
                  <span className="text-sm font-semibold text-primary">{formatCHF(part.preis_pro_stueck)}</span>
                  <span className="text-xs text-muted-foreground">Total</span>
                  <span className="text-sm font-bold">{formatCHF(part.preis_total)}</span>
                </div>

                {expandedPartIdx === idx && part.id && (
                  <div className="pt-2 border-t border-border/50">
                    <PartFileUpload
                      partId={part.id}
                      orderId={typeof id === "string" && id !== "neu" ? id : undefined}
                      customerId={customerId || undefined}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* Desktop: Tabelle */
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
                                    filament_verkauf_pro_g: fil ? (fil.verkaufspreis_pro_g ?? null) : undefined,
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
                      <td className="px-2 py-2"><Input type="number" value={part.menge} onChange={e => updatePart(idx, "menge", parseFloat(e.target.value) || 0)} className="bg-input border-border h-7 text-xs w-16" /></td>
                      <td className="px-2 py-2"><Input type="number" value={part.gewicht_g} onChange={e => updatePart(idx, "gewicht_g", parseFloat(e.target.value) || 0)} className="bg-input border-border h-7 text-xs w-20" step="0.1" /></td>
                      <td className="px-2 py-2"><Input type="number" value={part.druckzeit_h} onChange={e => updatePart(idx, "druckzeit_h", parseFloat(e.target.value) || 0)} className="bg-input border-border h-7 text-xs w-20" step="0.1" /></td>
                      <td className="px-2 py-2"><Input type="number" value={part.nachbearbeitung_h} onChange={e => updatePart(idx, "nachbearbeitung_h", parseFloat(e.target.value) || 0)} className="bg-input border-border h-7 text-xs w-20" step="0.1" /></td>
                      <td className="px-2 py-2"><Input type="number" value={part.konstruktion_h} onChange={e => updatePart(idx, "konstruktion_h", parseFloat(e.target.value) || 0)} className="bg-input border-border h-7 text-xs w-20" step="0.1" /></td>
                      <td className="px-2 py-2 text-right font-medium text-primary whitespace-nowrap">{formatCHF(part.preis_pro_stueck)}</td>
                      <td className="px-2 py-2 text-right font-medium whitespace-nowrap">{formatCHF(part.preis_total)}</td>
                      <td className="px-2 py-2">
                        <select value={part.status} onChange={e => updatePart(idx, "status", e.target.value)} className="h-7 px-2 rounded bg-input border border-border text-xs text-foreground">
                          {PART_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-2"><Input value={part.notizen} onChange={e => updatePart(idx, "notizen", e.target.value)} className="bg-input border-border h-7 text-xs w-24" placeholder="Notiz" /></td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1">
                          {part.id && (
                            <button onClick={() => setExpandedPartIdx(expandedPartIdx === idx ? null : idx)} className={`transition-colors p-1 ${expandedPartIdx === idx ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                              <Paperclip className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => removePart(idx)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedPartIdx === idx && part.id && (
                      <tr className="bg-muted/10 border-b border-border/50">
                        <td colSpan={12} className="px-4 py-3">
                          <PartFileUpload partId={part.id} orderId={typeof id === "string" && id !== "neu" ? id : undefined} customerId={customerId || undefined} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Zeit-Tracker – nur für gespeicherte Aufträge */}
      {!isNew && (
        <TimeTracker orderId={id!} parts={parts} />
      )}

      {/* Offertenmodus – nur für gespeicherte Aufträge */}
      {!isNew && (
        <OfferMode
          orderId={id!}
          orderName={orderName}
          customerId={customerId}
          datum={datum}
          beschreibung={beschreibung}
        />
      )}

      {/* Rechnungen & Zahlungen – nur für gespeicherte Aufträge */}
      {!isNew && (
        <BillsSection orderId={id!} />
      )}

      {/* Status Workflow – nur für gespeicherte Aufträge */}
      {!isNew && (
        <OrderStatusWorkflow
          orderId={id!}
          currentStatus={status}
          parts={parts.map(p => ({ status: p.status }))}
          trackingNr={trackingNr}
          onStatusChange={setStatus}
          onTrackingNrChange={setTrackingNr}
        />
      )}

      {/* Summary */}
      <div className="bg-card border border-border rounded-lg p-4 md:p-5 md:max-w-xs md:ml-auto">
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

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Auftrag löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dieser Auftrag und alle zugehörigen Teile und Dateien werden unwiderruflich gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteOrder}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
