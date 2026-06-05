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
import { ArrowLeft, Plus, Trash2, Save, FileDown, Tag, Paperclip, Mail, Loader2, MoreVertical, ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
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
  const [partsWithFiles, setPartsWithFiles] = useState<string[]>([]);
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
  const [expressKosten, setExpressKosten] = useState<number>(0);
  const [expressLabel, setExpressLabel] = useState<string>("");
  const [source, setSource] = useState<string>("manual");
  const [notesInternal, setNotesInternal] = useState<string>("");
  const [pendingStatusEmail, setPendingStatusEmail] = useState<string | null>(null);
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
  const TABS = ["Übersicht", "Teile", "Status & Versand", "Finanzen", "Dokumente"] as const;
  type Tab = typeof TABS[number];
  const [activeTab, setActiveTab] = useState<Tab>("Übersicht");
  const [creatingPaymentLink, setCreatingPaymentLink] = useState(false);
  const { toast } = useToast();

  const handleCreatePaymentLink = async () => {
    if (!id || totalUmsatz <= 0) return;
    setCreatingPaymentLink(true);
    try {
      const { customerEmail } = await getCustomerData();
      const { data, error } = await supabase.functions.invoke("create-stripe-payment-link", {
        body: { orderId: id, betrag: totalUmsatz, orderName, customerEmail },
      });
      if (error || data?.error) {
        toast({ title: "Stripe Fehler", description: data?.error || error?.message, variant: "destructive" });
      } else if (data?.url) {
        try { await navigator.clipboard.writeText(data.url); } catch {}
        toast({ title: "Zahlungslink erstellt ✓", description: "Link in Zwischenablage kopiert." });
      }
    } catch (e: any) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    }
    setCreatingPaymentLink(false);
  };

  const nextActionForStatus = (s: string): { label: string; onClick: () => void; disabled?: boolean } => {
    switch (s) {
      case "Offen": return { label: "Auftragsbestätigung senden →", onClick: () => setConfirmEmailType("auftragsbestaetigung") };
      case "In Bearbeitung": return { label: "Als versandbereit markieren →", onClick: () => setStatus("Geliefert") };
      case "Versandbereit": return { label: "Versandetikett erstellen →", onClick: () => window.open("https://www.post.ch/", "_blank") };
      case "Geliefert": return { label: "Rechnung senden →", onClick: () => setConfirmEmailType("rechnung") };
      case "Bezahlt": return { label: "Rechnung senden →", onClick: () => setConfirmEmailType("rechnung") };
      case "Abgeschlossen": return { label: "Auftrag abgeschlossen", onClick: () => {}, disabled: true };
      default: return { label: "Status aktualisieren →", onClick: () => {} };
    }
  };

  const PROGRESS_STEPS = ["Bestellt", "Bezahlt", "Produktion", "Versand", "Fertig"];
  const progressIndex = (() => {
    switch (status) {
      case "Offen": return 0;
      case "Bezahlt": return 1;
      case "In Bearbeitung": return 2;
      case "Versandbereit": return 3;
      case "Geliefert": return 3;
      case "Abgeschlossen": return 4;
      default: return 0;
    }
  })();

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
          setExpressKosten(Number((o as any).express_kosten) || 0);
          setExpressLabel((o as any).express_label || "");
          setSource((o as any).source || "manual");
          setNotesInternal((o as any).notes_internal || "");
          // Restore preset if saved
          const savedPresetId = (o as any).preset_id;
          if (savedPresetId) {
            setSelectedPresetId(savedPresetId);
            const preset = loadedPresets.find(pr => pr.id === savedPresetId);
            if (preset) {
              setActiveSettings({
                ...settings,
                setup_pauschale: preset.setup_pauschale,
                material_verkauf_pro_g: preset.material_verkauf_pro_g,
                maschinenzeit_pro_h: preset.maschinenzeit_pro_h,
                nachbearbeitung_pro_h: preset.nachbearbeitung_pro_h,
                konstruktion_pro_h: preset.konstruktion_pro_h,
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
      // Werte 1:1 aus Preset übernehmen (kein zusätzlicher Rabatt-Faktor)
      setActiveSettings({
        ...settings,
        setup_pauschale: preset.setup_pauschale,
        material_verkauf_pro_g: preset.material_verkauf_pro_g,
        maschinenzeit_pro_h: preset.maschinenzeit_pro_h,
        nachbearbeitung_pro_h: preset.nachbearbeitung_pro_h,
        konstruktion_pro_h: preset.konstruktion_pro_h,
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
    // Wenn ein Preis-Preset aktiv ist → Preset-Werte 1:1 verwenden (überschreibt Filament-Verkaufspreis)
    // Sonst: manueller Filament-Verkaufspreis → direkt; Einkaufspreis → Auto × 3; Fallback Settings
    let effectiveVerkaufProG = activeSettings.material_verkauf_pro_g;
    if (!selectedPresetId) {
      if (part.filament_verkauf_pro_g != null) {
        effectiveVerkaufProG = part.filament_verkauf_pro_g;
      } else if (part.filament_einkauf_pro_kg != null) {
        effectiveVerkaufProG = (part.filament_einkauf_pro_kg / 1000) * MATERIAL_AUFSCHLAG;
      }
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

  // Alle Teile neu kalkulieren wenn sich activeSettings oder das Preset ändert
  useEffect(() => {
    setParts(prev => prev.map(p => recalcPart(p)));
  }, [activeSettings, selectedPresetId]);

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
    navigate("/admin/auftraege");
  };

  // Totals
  const partsUmsatz = parts.reduce((s, p) => s + p.preis_total, 0);
  const expressBetrag = Math.max(0, Number(expressKosten) || 0);
  const totalUmsatz = partsUmsatz + expressBetrag;
  const totalKosten = parts.reduce((s, p) => {
    const einkauf = p.filament_einkauf_pro_kg ?? activeSettings.material_einkauf_pro_kg;
    const partSettings = { ...activeSettings, material_einkauf_pro_kg: einkauf };
    return s + calcKosten(partSettings, p.gewicht_g, p.druckzeit_h) * p.menge;
  }, 0);
  const totalGewinn = calcGewinn(totalUmsatz, totalKosten);
  const totalMarge = calcMarge(totalGewinn, totalUmsatz);

  // Auftragsname immer in der Beschreibung voranstellen
  const fullBeschreibung = [orderName, beschreibung].filter(Boolean).join("\n");

  // Setup-Pauschale wird pro Teil berechnet (siehe calcUmsatz), daher × Anzahl Teile
  const setupKosten = activeSettings.setup_pauschale * parts.length;
  const matKosten = parts.reduce((s, p) => {
    const verkaufPreis = p.filament_verkauf_pro_g ?? activeSettings.material_verkauf_pro_g;
    return s + p.gewicht_g * verkaufPreis * p.menge;
  }, 0);
  const maschKosten = parts.reduce((s, p) => s + p.druckzeit_h * activeSettings.maschinenzeit_pro_h * p.menge, 0);
  const nbKosten = parts.reduce((s, p) => s + p.nachbearbeitung_h * activeSettings.nachbearbeitung_pro_h * p.menge, 0);
  const konstrKosten = parts.reduce((s, p) => s + p.konstruktion_h * activeSettings.konstruktion_pro_h * p.menge, 0);

  const handleSendTestEmail = async () => {
    setSendingEmail("test" as any);
    try {
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: { kind: "order", orderId: id, type: "test" },
      });
      if (error || data?.error) {
        toast({ title: "Fehler", description: data?.error || error?.message, variant: "destructive" });
      } else {
        toast({ title: "Test-E-Mail gesendet ✓", description: "Eine Test-Nachricht wurde an die Kundenadresse gesendet." });
      }
    } catch (e: any) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    }
    setSendingEmail(null);
  };

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
            orderId: id || "neu", datum, beschreibung: fullBeschreibung, status,
            customerName, customerFirma, customerEmail, customerTelefon, customerAdresse,
            parts, umsatz_total: totalUmsatz, kosten_total: totalKosten,
            gewinn_total: totalGewinn, marge: totalMarge,
            settings: activeSettings, company, returnBase64: true, withDetails,
            expressKosten: expressBetrag, expressLabel,
          });
          if (result) { pdfBase64 = result.base64; pdfFilename = result.filename; }
        } else {
          const result = await exportOfferPDF({
            orderId: id || "neu", datum, beschreibung: fullBeschreibung,
            customerName, customerFirma, customerEmail, customerTelefon, customerAdresse,
            parts, umsatz_total: totalUmsatz, settings: activeSettings, company, returnBase64: true, withDetails,
            expressKosten: expressBetrag, expressLabel,
          });
          if (result) { pdfBase64 = result.base64; pdfFilename = result.filename; }
        }
      }

      const { data, error } = await supabase.functions.invoke("send-email", {
        body: { kind: "order", orderId: id, type, trackingNr, pdfBase64, pdfFilename, paymentUrl },
      });
      if (error || data?.error) {
        toast({ title: "Fehler", description: data?.error || error?.message, variant: "destructive" });
      } else {
        const labels: Record<string, string> = { rechnung: "Rechnung", offerte: "Offerte", lieferung: "Lieferbenachrichtigung", auftragsbestaetigung: "Auftragsbestätigung", druckfertig: "Druckfertig-Info" };
        toast({ title: "E-Mail gesendet ✓", description: `${labels[type]} wurde erfolgreich versandt.` });

        if (id) {
          const sentDate = `Gesendet am ${new Date().toLocaleDateString("de-CH")}`;
          const labelsMap: Record<string, string> = { rechnung: "Rechnung", offerte: "Offerte", lieferung: "Lieferbenachrichtigung", auftragsbestaetigung: "Auftragsbestätigung", druckfertig: "Druckfertig-Info" };
          let storedPath: string | null = null;
          let storedFilename: string | null = null;
          console.log("PDF Debug:", { hasPdfBase64: !!pdfBase64, pdfBase64Length: pdfBase64?.length, type, orderId: id });
          if (pdfBase64) {
            try {
              const pdfBlob = await fetch(`data:application/pdf;base64,${pdfBase64}`).then((r) => r.blob());
              const pdfPath = `${id}/${type}-${Date.now()}.pdf`;
              console.log("Uploading to bills storage:", pdfPath);
              const { data: uploadData, error: upErr } = await supabase.storage.from("bills").upload(pdfPath, pdfBlob, { contentType: "application/pdf", upsert: true });
              console.log("Upload result:", { uploadData, uploadError: upErr });
              if (!upErr) {
                storedPath = pdfPath;
                storedFilename = pdfFilename || `${type}-${id}.pdf`;
              }
            } catch (e) {
              console.error("Upload catch error:", e);
            }
          }
          const betragValue = type === "rechnung" ? totalUmsatz : type === "offerte" ? totalUmsatz : 0;
          const faelligAm = type === "rechnung" ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] : null;
          await supabase.from("bills" as any).insert({
            order_id: id,
            titel: `${labelsMap[type]} per E-Mail gesendet`,
            betrag: betragValue,
            faellig_am: faelligAm,
            notiz: sentDate,
            bezahlt: false,
            file_path: storedPath,
            filename: storedFilename,
          });
        }
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
        orderId: id || "neu", datum, beschreibung: fullBeschreibung, status,
        customerName, customerFirma, customerEmail, customerTelefon, customerAdresse,
        parts, umsatz_total: totalUmsatz, akontoPercent, akontoBetrag,
        settings: activeSettings, company, returnBase64: !download,
        expressKosten: expressBetrag, expressLabel,
      });
      if (!download && result) {
        // Send via email
        const { data, error } = await supabase.functions.invoke("send-email", {
          body: { kind: "order", orderId: id, type: "akonto", pdfBase64: result.base64, pdfFilename: result.filename, akontoPercent, akontoBetrag },
        });
        if (error || data?.error) {
          toast({ title: "Fehler", description: data?.error || error?.message, variant: "destructive" });
        } else {
          toast({ title: "Akontorechnung gesendet ✓", description: `${akontoPercent}% (${formatCHF(akontoBetrag)}) wurde per E-Mail versandt.` });
          if (id) {
            let storedPath: string | null = null;
            let storedFilename: string | null = null;
            try {
              const pdfBlob = await fetch(`data:application/pdf;base64,${result.base64}`).then((r) => r.blob());
              const pdfPath = `${id}/akonto-${Date.now()}.pdf`;
              const { error: upErr } = await supabase.storage.from("bills").upload(pdfPath, pdfBlob, { contentType: "application/pdf", upsert: false });
              if (!upErr) { storedPath = pdfPath; storedFilename = result.filename || `akonto-${id}.pdf`; }
            } catch {}
            await supabase.from("bills" as any).insert({
              order_id: id,
              titel: `Akontorechnung (${akontoPercent}%) per E-Mail gesendet`,
              betrag: Math.round(totalUmsatz * akontoPercent) / 100,
              notiz: `Gesendet am ${new Date().toLocaleDateString("de-CH")}`,
              bezahlt: false,
              file_path: storedPath,
              filename: storedFilename,
            });
          }
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
        orderId: id || "neu", datum, beschreibung: fullBeschreibung, status,
        customerName, customerFirma, customerEmail, customerTelefon, customerAdresse,
        parts, umsatz_total: totalUmsatz, akontoPercent, akontoBetrag, restbetrag,
        settings: activeSettings, company, returnBase64: !download,
        expressKosten: expressBetrag, expressLabel,
      });
      if (!download && result) {
        const { data, error } = await supabase.functions.invoke("send-email", {
          body: { kind: "order", orderId: id, type: "restbetrag", pdfBase64: result.base64, pdfFilename: result.filename, akontoPercent, akontoBetrag, restbetrag },
        });
        if (error || data?.error) {
          toast({ title: "Fehler", description: data?.error || error?.message, variant: "destructive" });
        } else {
          toast({ title: "Schlussrechnung gesendet ✓", description: `Restbetrag ${formatCHF(restbetrag)} wurde per E-Mail versandt.` });
          if (id) {
            let storedPath: string | null = null;
            let storedFilename: string | null = null;
            try {
              const pdfBlob = await fetch(`data:application/pdf;base64,${result.base64}`).then((r) => r.blob());
              const pdfPath = `${id}/restbetrag-${Date.now()}.pdf`;
              const { error: upErr } = await supabase.storage.from("bills").upload(pdfPath, pdfBlob, { contentType: "application/pdf", upsert: false });
              if (!upErr) { storedPath = pdfPath; storedFilename = result.filename || `restbetrag-${id}.pdf`; }
            } catch {}
            await supabase.from("bills" as any).insert({
              order_id: id,
              titel: `Schlussrechnung per E-Mail gesendet`,
              betrag: totalUmsatz - Math.round(totalUmsatz * akontoPercent) / 100,
              notiz: `Gesendet am ${new Date().toLocaleDateString("de-CH")}`,
              bezahlt: false,
              file_path: storedPath,
              filename: storedFilename,
            });
          }
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
      beschreibung: fullBeschreibung,
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
      expressKosten: expressBetrag,
      expressLabel,
    });
  };

  const handleExportOffer = async (details = false) => {
    const { customerName, customerFirma, customerEmail, customerTelefon, customerAdresse } = await getCustomerData();
    exportOfferPDF({
      orderId: id || "neu",
      datum,
      beschreibung: fullBeschreibung,
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
      expressKosten: expressBetrag,
      expressLabel,
    });
  };

  const handleExportAuftragsbestaetigung = async () => {
    const { customerName, customerFirma, customerEmail, customerTelefon, customerAdresse } = await getCustomerData();
    exportAuftragsbestaetiguungPDF({
      orderId: id || "neu",
      datum,
      beschreibung: fullBeschreibung,
      customerName,
      customerFirma,
      customerEmail,
      customerTelefon,
      customerAdresse,
      parts,
      umsatz_total: totalUmsatz,
      settings: activeSettings,
      company,
      expressKosten: expressBetrag,
      expressLabel,
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
      express_kosten: expressBetrag,
      express_label: expressLabel || null,
      notes_internal: notesInternal || null,
    };

    let orderId = id === "neu" ? null : id;

    if (isNew) {
      const { data } = await supabase.from("orders").insert(orderData as any).select().single();
      orderId = data?.id;
    } else {
      await supabase.from("orders").update(orderData as any).eq("id", id!);
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
      navigate(`/admin/auftraege/${orderId}`, { replace: true });
    } else {
      // Reload parts from DB to sync IDs, without losing local UI state
      const { data: freshParts } = await supabase.from("parts").select("*").eq("order_id", id!);
      if (freshParts) setParts(freshParts as PartRow[]);
      toast({ title: "Gespeichert ✓" });
    }
  };

  if (loading) return <div className="p-4 md:p-8 text-muted-foreground">Laden...</div>;

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-2 md:gap-4">
        <button onClick={() => navigate("/admin/auftraege")} className="text-muted-foreground hover:text-foreground transition-colors p-1 shrink-0">
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
                  <DropdownMenuItem onClick={handleSendTestEmail} disabled={!!sendingEmail} className="gap-2">
                    {sendingEmail === "test" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} Test-E-Mail senden
                  </DropdownMenuItem>
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
                    <DropdownMenuItem onClick={handleSendTestEmail} className="gap-2">
                      <Mail className="w-4 h-4" /> Test-E-Mail senden
                    </DropdownMenuItem>
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

      {/* Sub-header: Auftrags-ID + Kunde + Datum */}
      {!isNew && (
        <div className="text-xs text-muted-foreground -mt-2">
          ID: <span className="font-mono">{(id || "").slice(0, 8)}</span>
          {customerId && customers.find(c => c.id === customerId) && (
            <> · {customers.find(c => c.id === customerId)!.name}</>
          )}
          {" · "}{datum}
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex gap-0 border-b border-border overflow-x-auto">
        {(isNew ? (["Übersicht", "Teile"] as Tab[]) : (TABS as readonly Tab[])).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ====================== TAB: ÜBERSICHT ====================== */}
      {activeTab === "Übersicht" && (
        <div className="space-y-4 md:space-y-6">
          {source === "anfrage" && !isNew && (
            <div className="bg-muted/50 border border-border rounded-lg px-4 py-2.5 flex items-center gap-2 text-sm text-muted-foreground">
              <MessageSquare className="w-4 h-4" />
              Aus Anfrage erstellt — bitte Gewicht, Druckzeit und Materialparameter ergänzen
            </div>
          )}
          {!isNew && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="text-xs text-muted-foreground mb-1">Umsatz</div>
                <div className="text-xl font-bold text-success">{formatCHF(totalUmsatz)}</div>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="text-xs text-muted-foreground mb-1">Gewinn</div>
                <div className="text-xl font-bold text-success">{formatCHF(totalGewinn)}</div>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="text-xs text-muted-foreground mb-1">Marge</div>
                <div className="text-xl font-bold">{formatPct(totalMarge)}</div>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="text-xs text-muted-foreground mb-1">Anzahl Teile</div>
                <div className="text-xl font-bold">{parts.length}</div>
              </div>
            </div>
          )}

          {/* Auftragsname (immer) */}
          <div className="bg-card border border-border rounded-lg p-4 md:p-5">
            <div className="space-y-1.5">
              <Label>Auftragsname <span className="text-muted-foreground font-normal text-xs">(wird als E-Mail-Betreff verwendet)</span></Label>
              <Input
                value={orderName}
                onChange={e => setOrderName(e.target.value)}
                placeholder="z.B. Halterungen für Kundenanlage, Prototyp Serie A …"
                className="bg-input border-border"
              />
            </div>
          </div>

          {/* 2-column grid: Auftragsinfo + Beschreibung/Notizen */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-lg p-4 md:p-5 space-y-3">
              <h3 className="font-semibold text-sm">Auftragsinfo</h3>
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
              {!isNew && (
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <div className="flex items-center gap-2">
                    <select
                      value={status}
                      onChange={e => setStatus(e.target.value)}
                      className="flex-1 h-9 px-3 rounded-md bg-input border border-border text-sm text-foreground"
                    >
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <StatusBadge status={status} />
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Datum</Label>
                <Input type="date" value={datum} onChange={e => setDatum(e.target.value)} className="bg-input border-border" />
              </div>
              {!isNew && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Von</Label>
                      <Input type="date" value={geplantVon} onChange={e => setGeplantVon(e.target.value)} className="bg-input border-border" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Bis</Label>
                      <Input type="date" value={geplantBis} onChange={e => setGeplantBis(e.target.value)} className="bg-input border-border" />
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Quelle: {source === "website" ? <span className="text-primary font-medium">Website-Bestellung</span> : source}
                  </div>
                </>
              )}
            </div>

            <div className="bg-card border border-border rounded-lg p-4 md:p-5 space-y-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2">
                  Beschreibung
                  {source === "website" && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium">Website</span>
                  )}
                </Label>
                <Textarea value={beschreibung} onChange={e => setBeschreibung(e.target.value)} className="bg-input border-border" rows={4} />
              </div>
              {!isNew && (
                <div className="space-y-1.5">
                  <Label>Interne Notizen <span className="text-muted-foreground font-normal text-xs">(nie für Kunden sichtbar)</span></Label>
                  <Textarea value={notesInternal} onChange={e => setNotesInternal(e.target.value)} className="bg-input border-border" rows={3} placeholder="Nur intern sichtbar..." />
                </div>
              )}
            </div>
          </div>

          {/* Fortschrittsbalken */}
          {!isNew && (
            <div className="bg-card border border-border rounded-lg p-4 md:p-5">
              <h3 className="font-semibold text-sm mb-4">Fortschritt</h3>
              <div className="flex items-center w-full">
                {PROGRESS_STEPS.map((step, i) => {
                  const done = i < progressIndex;
                  const active = i === progressIndex;
                  return (
                    <div key={step} className="flex items-center flex-1 last:flex-none">
                      <div className="flex flex-col items-center gap-1.5">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 ${
                          active ? "bg-primary border-primary text-primary-foreground" :
                          done ? "bg-success border-success text-white" :
                          "bg-muted border-border text-muted-foreground"
                        }`}>
                          {i + 1}
                        </div>
                        <span className={`text-[10px] font-medium whitespace-nowrap ${active ? "text-primary" : done ? "text-success" : "text-muted-foreground"}`}>{step}</span>
                      </div>
                      {i < PROGRESS_STEPS.length - 1 && (
                        <div className="flex-1 h-0.5 mx-1 mb-5 bg-border relative overflow-hidden rounded">
                          <div className={`absolute inset-y-0 left-0 transition-all ${done ? "w-full bg-success" : "w-0"}`} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}


          {/* Nächste Aktion */}
          {!isNew && (() => {
            const action = nextActionForStatus(status);
            return (
              <Button
                onClick={action.onClick}
                disabled={action.disabled}
                className={`w-full ${action.disabled ? "bg-muted text-muted-foreground hover:bg-muted" : "bg-primary hover:bg-primary/90"}`}
                size="lg"
              >
                {action.label}
              </Button>
            );
          })()}
        </div>
      )}

      {/* ====================== TAB: TEILE ====================== */}
      {activeTab === "Teile" && (
        <div className="space-y-4">
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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
                                    Einkauf: CHF {part.filament_einkauf_pro_kg}/kg → Verkauf:{" "}
                                    {part.filament_verkauf_pro_g != null
                                      ? <span className="text-primary">CHF {part.filament_verkauf_pro_g.toFixed(3)}/g (manuell)</span>
                                      : `CHF ${((part.filament_einkauf_pro_kg / 1000) * MATERIAL_AUFSCHLAG).toFixed(3)}/g`
                                    }
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

          {/* Express */}
          {!isNew && (
            <div className="bg-card border border-border rounded-lg p-4 md:p-5">
              <h3 className="font-semibold text-sm mb-3">Express-Lieferung</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Bezeichnung (optional)</Label>
                  <Input
                    value={expressLabel}
                    onChange={e => setExpressLabel(e.target.value)}
                    placeholder="z.B. Express 24h, Eilversand DHL Express"
                    className="bg-input border-border"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Kosten (CHF)</Label>
                  <Input
                    type="number" step="0.05" min="0"
                    value={expressKosten || ""}
                    onChange={e => setExpressKosten(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="bg-input border-border"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Kostenaufschlüsselung kompakt */}
          {!isNew && (
            <div className="bg-card border border-border rounded-lg p-4 md:p-5">
              <h3 className="font-semibold text-sm mb-3">Kostenaufschlüsselung</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Setup</span><span>{formatCHF(setupKosten)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Material</span><span>{formatCHF(matKosten)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Maschinenzeit</span><span>{formatCHF(maschKosten)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Nachbearbeitung</span><span>{formatCHF(nbKosten)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Konstruktion</span><span>{formatCHF(konstrKosten)}</span></div>
                <div className="flex justify-between font-bold"><span>Total</span><span className="text-primary">{formatCHF(totalUmsatz)}</span></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ====================== TAB: STATUS & VERSAND ====================== */}
      {activeTab === "Status & Versand" && !isNew && (
        <div className="space-y-4">
          <OrderStatusWorkflow
            orderId={id!}
            currentStatus={status}
            parts={parts.map(p => ({ status: p.status }))}
            trackingNr={trackingNr}
            onStatusChange={setStatus}
            onTrackingNrChange={setTrackingNr}
          />
          <div className="bg-card border border-border rounded-lg p-4 md:p-5 space-y-3">
            <h3 className="font-semibold text-sm">Tracking & Termine</h3>
            <div className="space-y-1.5">
              <Label>Tracking-Nummer</Label>
              <div className="flex gap-2">
                <Input value={trackingNr} onChange={e => setTrackingNr(e.target.value)} className="bg-input border-border" placeholder="z.B. CH123456789DE" />
                <Button onClick={handleSave} disabled={saving} variant="outline" className="border-border gap-2">
                  <Save className="w-4 h-4" /> Speichern
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Geplant von</Label>
                <Input type="date" value={geplantVon} onChange={e => setGeplantVon(e.target.value)} className="bg-input border-border" />
              </div>
              <div className="space-y-1.5">
                <Label>Geplant bis</Label>
                <Input type="date" value={geplantBis} onChange={e => setGeplantBis(e.target.value)} className="bg-input border-border" />
              </div>
            </div>
          </div>
          <TimeTracker orderId={id!} parts={parts} />
        </div>
      )}

      {/* ====================== TAB: FINANZEN ====================== */}
      {activeTab === "Finanzen" && !isNew && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-lg p-4 md:p-5">
              <h3 className="font-semibold text-sm mb-3">Kostenaufschlüsselung</h3>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Setup-Pauschale</span><span>{formatCHF(setupKosten)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Material</span><span>{formatCHF(matKosten)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Maschinenzeit</span><span>{formatCHF(maschKosten)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Nachbearbeitung</span><span>{formatCHF(nbKosten)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Konstruktion</span><span>{formatCHF(konstrKosten)}</span></div>
                {expressBetrag > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">{expressLabel?.trim() || "Express"}</span><span>{formatCHF(expressBetrag)}</span></div>
                )}
                <div className="border-t border-border my-2" />
                <div className="flex justify-between font-bold"><span>Total Umsatz</span><span className="text-primary">{formatCHF(totalUmsatz)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Meine Kosten</span><span className="text-destructive">{formatCHF(totalKosten)}</span></div>
                <div className="flex justify-between font-bold"><span>Reingewinn</span><span className="text-success">{formatCHF(totalGewinn)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Marge</span><span>{formatPct(totalMarge)}</span></div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button onClick={() => setShowAkontoDialog(true)} variant="outline" className="gap-2 border-border w-full">
                <FileDown className="w-4 h-4" /> Akontorechnung erstellen
              </Button>
              <Button onClick={handleCreatePaymentLink} disabled={creatingPaymentLink || totalUmsatz <= 0} variant="outline" className="gap-2 border-border w-full">
                {creatingPaymentLink ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />} Stripe Zahlungslink erstellen
              </Button>
            </div>
          </div>
          <BillsSection orderId={id!} />
        </div>
      )}

      {/* ====================== TAB: DOKUMENTE ====================== */}
      {activeTab === "Dokumente" && !isNew && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-lg p-4 md:p-5 space-y-2">
              <h3 className="font-semibold text-sm mb-2">PDF herunterladen</h3>
              <Button onClick={() => handleExportPDF(false)} variant="outline" className="w-full justify-start gap-2 border-border"><FileDown className="w-4 h-4" /> Rechnung</Button>
              <Button onClick={() => handleExportPDF(true)} variant="outline" className="w-full justify-start gap-2 border-border"><FileDown className="w-4 h-4" /> Rechnung (mit Details)</Button>
              <Button onClick={() => handleExportOffer(false)} variant="outline" className="w-full justify-start gap-2 border-border"><FileDown className="w-4 h-4" /> Offerte</Button>
              <Button onClick={() => handleExportOffer(true)} variant="outline" className="w-full justify-start gap-2 border-border"><FileDown className="w-4 h-4" /> Offerte (mit Details)</Button>
              <Button onClick={() => handleExportAuftragsbestaetigung()} variant="outline" className="w-full justify-start gap-2 border-border"><FileDown className="w-4 h-4" /> Auftragsbestätigung</Button>
              <Button onClick={() => setShowAkontoDialog(true)} variant="outline" className="w-full justify-start gap-2 border-border"><FileDown className="w-4 h-4" /> Akontorechnung</Button>
            </div>
            <div className="bg-card border border-border rounded-lg p-4 md:p-5 space-y-2">
              <h3 className="font-semibold text-sm mb-2">E-Mail senden</h3>
              <Button onClick={() => setConfirmEmailType("rechnung")} disabled={!!sendingEmail} variant="outline" className="w-full justify-start gap-2 border-border"><Mail className="w-4 h-4" /> Rechnung</Button>
              <Button onClick={() => setConfirmEmailType("offerte")} disabled={!!sendingEmail} variant="outline" className="w-full justify-start gap-2 border-border"><Mail className="w-4 h-4" /> Offerte</Button>
              <Button onClick={() => setConfirmEmailType("auftragsbestaetigung")} disabled={!!sendingEmail} variant="outline" className="w-full justify-start gap-2 border-border"><Mail className="w-4 h-4" /> Auftragsbestätigung</Button>
              <Button onClick={() => setConfirmEmailType("druckfertig")} disabled={!!sendingEmail} variant="outline" className="w-full justify-start gap-2 border-border"><Mail className="w-4 h-4" /> Druckfertig-Info</Button>
              <Button onClick={() => setConfirmEmailType("lieferung")} disabled={!!sendingEmail} variant="outline" className="w-full justify-start gap-2 border-border"><Mail className="w-4 h-4" /> Lieferbenachrichtigung</Button>
              <Button onClick={handleSendTestEmail} disabled={!!sendingEmail} variant="outline" className="w-full justify-start gap-2 border-border">
                {sendingEmail === "test" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} Test-E-Mail
              </Button>
            </div>
          </div>
          <OfferMode
            orderId={id!}
            orderName={orderName}
            customerId={customerId}
            datum={datum}
            beschreibung={beschreibung}
          />
        </div>
      )}


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
