import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Save, FileDown, Mail, Loader2, ClipboardList, ChevronDown } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCHF } from "@/lib/calc";
import { useCompanySettings } from "@/contexts/CompanySettingsContext";
import { exportOfferPositionsPDF } from "@/lib/pdfOfferPositionsExport";
import type { CompanySettings } from "@/lib/companySettings";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface OfferPosition {
  id?: string;
  bezeichnung: string;
  menge: number;
  einheit: string;
  preis_pro_einheit: number;
  total?: number;
  notiz: string;
  position_order: number;
}

const EINHEITEN = ["Stk.", "h", "kg", "m", "m²", "Pauschal", "Set"];

const emptyPos = (order: number): OfferPosition => ({
  bezeichnung: "", menge: 1, einheit: "Stk.", preis_pro_einheit: 0, notiz: "", position_order: order,
});

interface Props {
  orderId: string;
  orderName?: string;
  customerId?: string;
  datum?: string;
  beschreibung?: string;
}

export default function OfferMode({ orderId, orderName, customerId, datum, beschreibung }: Props) {
  const [positions, setPositions] = useState<OfferPosition[]>([emptyPos(0)]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showEmailConfirm, setShowEmailConfirm] = useState(false);
  const [offerNote, setOfferNote] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);
  const { toast } = useToast();
  const { company } = useCompanySettings();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("offer_positions")
        .select("*")
        .eq("order_id", orderId)
        .order("position_order");
      if (data && data.length > 0) {
        setPositions(data as OfferPosition[]);
      }
      setLoading(false);
    }
    load();
  }, [orderId]);

  const updatePos = (idx: number, field: keyof OfferPosition, value: string | number) => {
    setPositions(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  };

  const addPos = () => {
    setPositions(prev => [...prev, emptyPos(prev.length)]);
  };

  const removePos = (idx: number) => {
    setPositions(prev => prev.filter((_, i) => i !== idx));
  };

  const totalBetrag = positions.reduce((s, p) => s + p.menge * p.preis_pro_einheit, 0);

  const handleSave = async () => {
    setSaving(true);
    try {
      await supabase.from("offer_positions").delete().eq("order_id", orderId);
      const rows = positions.map((p, i) => ({
        order_id: orderId,
        bezeichnung: p.bezeichnung,
        menge: p.menge,
        einheit: p.einheit,
        preis_pro_einheit: p.preis_pro_einheit,
        notiz: p.notiz,
        position_order: i,
      }));
      const { data, error } = await supabase.from("offer_positions").insert(rows).select();
      if (error) throw error;
      if (data) setPositions(data as OfferPosition[]);
      toast({ title: "Offerte gespeichert ✓" });
    } catch (e: any) {
      toast({ title: "Fehler beim Speichern", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const getCustomerData = async () => {
    let customerName = "Kein Kunde";
    let customerFirma, customerEmail, customerTelefon, customerAdresse;
    if (customerId) {
      const { data: c } = await supabase.from("customers").select("*").eq("id", customerId).single();
      if (c) {
        customerName = [c.vorname, c.name].filter(Boolean).join(" ") || c.name;
        customerFirma = c.firma ?? undefined;
        customerEmail = c.email ?? undefined;
        customerTelefon = c.telefon ?? undefined;
        const parts: string[] = [];
        if (c.strasse || c.hausnummer) parts.push(`${c.strasse || ""} ${c.hausnummer || ""}`.trim());
        if (c.plz || c.ort) parts.push(`${c.plz || ""} ${c.ort || ""}`.trim());
        customerAdresse = parts.join("\n") || c.adresse || undefined;
      }
    }
    return { customerName, customerFirma, customerEmail, customerTelefon, customerAdresse };
  };

  const subtotal = positions.reduce((s, p) => s + p.menge * p.preis_pro_einheit, 0);
  const discountAmount = subtotal * (discountPercent / 100);
  const totalBetragFinal = subtotal - discountAmount;

  const handleExportPDF = async () => {
    const cData = await getCustomerData();
    exportOfferPositionsPDF({
      orderId,
      datum: datum || new Date().toISOString().split("T")[0],
      orderName,
      beschreibung,
      offerNote,
      positions,
      total: totalBetragFinal,
      discountPercent,
      company,
      ...cData,
    });
  };

  const handleSendEmail = async () => {
    setSendingEmail(true);
    try {
      const cData = await getCustomerData();
      const result = await exportOfferPositionsPDF({
        orderId,
        datum: datum || new Date().toISOString().split("T")[0],
        orderName,
        beschreibung,
        offerNote,
        positions,
        total: totalBetragFinal,
        discountPercent,
        company,
        returnBase64: true,
        ...cData,
      });
      const { data, error } = await supabase.functions.invoke("send-order-email", {
        body: {
          orderId,
          type: "offerte",
          pdfBase64: result && "base64" in result ? result.base64 : undefined,
          pdfFilename: result && "filename" in result ? result.filename : undefined,
        },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast({ title: "Offerte per E-Mail gesendet ✓" });
    } catch (e: any) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    }
    setSendingEmail(false);
  };

  if (loading) return null;

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between bg-muted/20">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-sm">Offertenmodus</h2>
          <span className="text-xs text-muted-foreground ml-1">Tätigkeiten &amp; Positionen für die Offerte</span>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={addPos} variant="outline" size="sm" className="gap-1.5 border-border text-xs">
            <Plus className="w-3.5 h-3.5" />Position
          </Button>
          <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5 text-xs">
            <Save className="w-3.5 h-3.5" />
            {saving ? "Speichern..." : "Speichern"}
          </Button>
          <Button onClick={handleExportPDF} variant="outline" size="sm" className="gap-1.5 border-border text-xs">
            <FileDown className="w-3.5 h-3.5" />PDF
          </Button>
          <Button
            onClick={() => setShowEmailConfirm(true)}
            disabled={sendingEmail}
            variant="outline"
            size="sm"
            className="gap-1.5 border-border text-xs"
          >
            {sendingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
            Mailen
          </Button>
        </div>
      </div>

      {/* Positions table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[700px]">
          <thead>
            <tr className="border-b border-border bg-muted/10">
              <th className="px-3 py-2.5 text-left text-muted-foreground font-medium w-8">#</th>
              <th className="px-3 py-2.5 text-left text-muted-foreground font-medium">Bezeichnung / Tätigkeit</th>
              <th className="px-3 py-2.5 text-left text-muted-foreground font-medium w-20">Menge</th>
              <th className="px-3 py-2.5 text-left text-muted-foreground font-medium w-24">Einheit</th>
              <th className="px-3 py-2.5 text-left text-muted-foreground font-medium w-28">Preis/Einheit</th>
              <th className="px-3 py-2.5 text-right text-muted-foreground font-medium w-28">Total</th>
              <th className="px-3 py-2.5 text-left text-muted-foreground font-medium">Notiz</th>
              <th className="px-3 py-2.5 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {positions.map((pos, idx) => (
              <tr key={idx} className="border-b border-border/50 hover:bg-muted/10">
                <td className="px-3 py-2 text-muted-foreground font-medium">{idx + 1}</td>
                <td className="px-2 py-2">
                  <Input
                    value={pos.bezeichnung}
                    onChange={e => updatePos(idx, "bezeichnung", e.target.value)}
                    className="bg-input border-border h-7 text-xs"
                    placeholder="z.B. 3D-Druck PLA Halterung, Konstruktion CAD, Nachbearbeitung…"
                  />
                </td>
                <td className="px-2 py-2">
                  <Input
                    type="number"
                    value={pos.menge}
                    onChange={e => updatePos(idx, "menge", parseFloat(e.target.value) || 0)}
                    className="bg-input border-border h-7 text-xs w-16"
                    min={0}
                    step="0.5"
                  />
                </td>
                <td className="px-2 py-2">
                  <select
                    value={pos.einheit}
                    onChange={e => updatePos(idx, "einheit", e.target.value)}
                    className="h-7 px-2 rounded bg-input border border-border text-xs text-foreground w-full"
                  >
                    {EINHEITEN.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </td>
                <td className="px-2 py-2">
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground text-[10px]">CHF</span>
                    <Input
                      type="number"
                      value={pos.preis_pro_einheit}
                      onChange={e => updatePos(idx, "preis_pro_einheit", parseFloat(e.target.value) || 0)}
                      className="bg-input border-border h-7 text-xs w-20"
                      min={0}
                      step="0.5"
                    />
                  </div>
                </td>
                <td className="px-3 py-2 text-right font-semibold text-primary whitespace-nowrap">
                  {formatCHF(pos.menge * pos.preis_pro_einheit)}
                </td>
                <td className="px-2 py-2">
                  <Input
                    value={pos.notiz}
                    onChange={e => updatePos(idx, "notiz", e.target.value)}
                    className="bg-input border-border h-7 text-xs"
                    placeholder="Optionale Notiz…"
                  />
                </td>
                <td className="px-2 py-2">
                  <button
                    onClick={() => removePos(idx)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {discountPercent > 0 && (
              <>
                <tr className="bg-muted/10">
                  <td colSpan={5} className="px-3 py-2 text-xs text-right text-muted-foreground">Zwischensumme</td>
                  <td className="px-3 py-2 text-right text-xs text-muted-foreground whitespace-nowrap">{formatCHF(subtotal)}</td>
                  <td colSpan={2} />
                </tr>
                <tr className="bg-muted/10">
                  <td colSpan={5} className="px-3 py-2 text-xs text-right text-muted-foreground">Rabatt {discountPercent}%</td>
                  <td className="px-3 py-2 text-right text-xs text-destructive whitespace-nowrap">- {formatCHF(discountAmount)}</td>
                  <td colSpan={2} />
                </tr>
              </>
            )}
            <tr className="bg-muted/20">
              <td colSpan={5} className="px-3 py-3 text-sm font-semibold text-right">Gesamtbetrag</td>
              <td className="px-3 py-3 text-right font-bold text-primary text-sm whitespace-nowrap">
                {formatCHF(totalBetragFinal)}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Discount + Offer note */}
      <div className="px-5 py-4 border-t border-border flex flex-col gap-3">
        <div className="flex items-center gap-4">
          <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">Rabatt (%)</label>
          <Input
            type="number"
            value={discountPercent}
            onChange={e => setDiscountPercent(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
            className="bg-input border-border h-7 text-xs w-20"
            min={0}
            max={100}
            step={1}
            placeholder="0"
          />
          {discountPercent > 0 && (
            <span className="text-xs text-destructive font-medium">
              − {formatCHF(discountAmount)} Rabatt → Gesamt: {formatCHF(totalBetragFinal)}
            </span>
          )}
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Bemerkungen / Konditionen (erscheinen auf der Offerte)</label>
          <Textarea
            value={offerNote}
            onChange={e => setOfferNote(e.target.value)}
            placeholder="z.B. Gültig 30 Tage, Lieferzeit 5–7 Werktage, Zahlung innert 30 Tagen netto…"
            className="bg-input border-border text-xs"
            rows={2}
          />
        </div>
      </div>

      {/* Email confirmation */}
      <AlertDialog open={showEmailConfirm} onOpenChange={setShowEmailConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Offerte wirklich senden?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Offerte mit allen Positionen wird als PDF per E-Mail an den Kunden gesendet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowEmailConfirm(false); handleSendEmail(); }}>
              Ja, senden
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
