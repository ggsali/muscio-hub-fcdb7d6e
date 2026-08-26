import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Circle, Clock, Lock, Truck, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";


const STATUSES_MANUAL = ["Offen", "In Bearbeitung", "Bezahlt", "Geliefert", "Abgeschlossen"] as const;
const STATUSES_WEBSITE = ["Offen", "Bezahlt", "In Bearbeitung", "Geliefert", "Abgeschlossen"] as const;
type OrderStatus = typeof STATUSES_MANUAL[number];

interface LogEntry {
  id: string;
  status: string;
  notiz: string | null;
  created_at: string;
}

interface PartSummary {
  status: string;
}

interface Props {
  orderId: string;
  currentStatus: string;
  parts: PartSummary[];
  trackingNr?: string;
  source?: string;
  lieferart?: "versand" | "abholung";
  onStatusChange: (newStatus: string) => void;
  onTrackingNrChange?: (nr: string) => void;
}

export default function OrderStatusWorkflow({
  orderId, currentStatus, parts, trackingNr = "", source, lieferart = "versand", onStatusChange, onTrackingNrChange
}: Props) {
  const [log, setLog] = useState<LogEntry[]>([]);
  const [loadingLog, setLoadingLog] = useState(true);
  const [showTrackingInput, setShowTrackingInput] = useState(false);
  const [trackingInput, setTrackingInput] = useState(trackingNr);
  const [savingTracking, setSavingTracking] = useState(false);
  const [editingTracking, setEditingTracking] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewSending, setReviewSending] = useState(false);


  const isWebsiteOrder = source === 'website' || source === 'shop' || source === 'kalkulator'
  const STATUSES = isWebsiteOrder ? STATUSES_WEBSITE : STATUSES_MANUAL

  const loadLog = async () => {
    const { data } = await (supabase.from as any)("order_status_log")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false });
    if (data) setLog(data as LogEntry[]);
    setLoadingLog(false);
  };

  useEffect(() => {
    if (orderId) loadLog();
  }, [orderId]);

  // Teile-Analyse
  const totalParts = parts.length;
  const fertigParts = parts.filter(p => p.status === "Fertig" || p.status === "Geliefert").length;
  const allFertig = totalParts > 0 && fertigParts === totalParts;
  const anyInDruck = parts.some(p => p.status === "In Druck");

  // Automatisch abgeleiteter "vorgeschlagener" Status
  const suggestedStatus: string | null = (() => {
    if (!isWebsiteOrder) {
      if (currentStatus === 'Offen') return 'In Bearbeitung'
      if (currentStatus === 'In Bearbeitung' && allFertig) return 'Bezahlt'
      if (currentStatus === 'Bezahlt') return 'Geliefert'
      if (currentStatus === 'Geliefert') return 'Abgeschlossen'
    } else {
      if (currentStatus === 'Offen') return 'Bezahlt'
      if (currentStatus === 'Bezahlt') return 'In Bearbeitung'
      if (currentStatus === 'In Bearbeitung' && allFertig) return 'Geliefert'
      if (currentStatus === 'Geliefert') return 'Abgeschlossen'
    }
    return null
  })();

  // Welche Steps sind erlaubt (klickbar)?
  const isStepAllowed = (s: OrderStatus): boolean => {
    const cur = STATUSES.indexOf(currentStatus as OrderStatus)
    const target = STATUSES.indexOf(s)
    if (cur === -1) return false
    if (target <= cur) return true
    if (target === cur + 1) return true
    return false
  }

  const handleStatusClick = async (newStatus: OrderStatus) => {
    if (newStatus === currentStatus) return;
    if (!isStepAllowed(newStatus)) return;

    if (newStatus === "Geliefert" && lieferart === "versand") {
      setShowTrackingInput(true);
      return;
    }

    if (newStatus === "Bezahlt") {
      setShowPaymentDialog(true);
      return;
    }

    await commitStatus(newStatus, null);
  };

  const handleConfirmPayment = async (method: "stripe" | "rechnung") => {
    setSavingPayment(true);
    try {
      const notiz = method === "stripe"
        ? "Manuell bestätigt – Zahlung via Stripe"
        : "Manuell als bezahlt markiert – Zahlung per Rechnung/Überweisung";
      if (method === "rechnung") {
        const today = new Date().toISOString().slice(0, 10);
        await (supabase.from as any)("bills")
          .update({ bezahlt: true, bezahlt_am: today, notiz: "Bezahlt per Rechnung (manuell erfasst)" })
          .eq("order_id", orderId)
          .eq("bezahlt", false);
      }
      await commitStatus("Bezahlt", notiz);
      setShowPaymentDialog(false);
    } finally {
      setSavingPayment(false);
    }
  };

  const STATUS_TO_TEMPLATE: Record<string, string> = {
    "In Bearbeitung": "im_druck",
    "Geliefert": "versandt",
  };

  const commitStatus = async (newStatus: string, notiz: string | null) => {
    await (supabase.from as any)("order_status_log").insert({ order_id: orderId, status: newStatus, notiz });
    onStatusChange(newStatus);
    await loadLog();
    setShowTrackingInput(false);
    const tplKey = STATUS_TO_TEMPLATE[newStatus];
    if (tplKey) {
      try {
        await supabase.functions.invoke("send-email", {
          body: { kind: "status", orderId, statusKey: tplKey, trackingNr: trackingInput || trackingNr || null, lieferart },
        });
      } catch (e) { console.error("send-email status failed", e); }
    }

    if (newStatus === "Abgeschlossen") {
      try {
        const { data: order } = await supabase
          .from("orders")
          .select("bewertungs_token, customer_id, customers:customer_id(email, vorname, name)")
          .eq("id", orderId)
          .single();
        let token = (order as any)?.bewertungs_token as string | null;
        if (!token) {
          token = crypto.randomUUID();
          await supabase.from("orders").update({ bewertungs_token: token } as any).eq("id", orderId);
        }
        const customer = (order as any)?.customers;
        const customerEmail = customer?.email;
        const customerName = `${customer?.vorname || ""} ${customer?.name || ""}`.trim();
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "bewertung",
            recipientEmail: customerEmail,
            recipientName: customerName,
            idempotencyKey: `bewertung-${orderId}`,
            templateData: {
              name: customerName,
              bewertungsLink: `https://3dmuscio.com/bewertung/${token}`,
            },
          },
        });
        await (supabase.from as any)("order_status_log").insert({
          order_id: orderId,
          status: "Abgeschlossen",
          notiz: `✉️ Bewertungsanfrage automatisch gesendet an ${customerEmail}`,
          created_at: new Date().toISOString(),
        });
        loadLog?.();
      } catch (e) {
        console.error("bewertung email failed", e);
        await (supabase.from as any)("order_status_log").insert({
          order_id: orderId,
          status: "Abgeschlossen",
          notiz: "⚠️ Bewertungsanfrage konnte nicht gesendet werden",
          created_at: new Date().toISOString(),
        });
        loadLog?.();
      }
    }

  };

  const handleConfirmDelivery = async () => {
    if (savingTracking) return; // Doppelklick verhindern
    setSavingTracking(true);
    try {
      const notiz = trackingInput ? `Tracking-Nr.: ${trackingInput}` : null;

      // Tracking-Nr. speichern
      await supabase
        .from("orders")
        .update({ tracking_nr: trackingInput || null } as any)
        .eq("id", orderId);

      onTrackingNrChange?.(trackingInput);

      // Status setzen
      await commitStatus("Geliefert", notiz);

      // Tracking-Input schliessen
      setShowTrackingInput(false);

    } catch (e) {
      console.error("handleConfirmDelivery failed", e);
      toast.error("Fehler beim Speichern", {
        description: "Bitte nochmal versuchen.",
      });
    } finally {
      setSavingTracking(false); // Immer zurücksetzen, auch bei Fehler
    }
  };


  const currentIdx = STATUSES.indexOf(currentStatus as OrderStatus);


  const bannerText = (() => {
    if (!isWebsiteOrder) {
      if (suggestedStatus === 'In Bearbeitung') return 'Teile sind in Bearbeitung – Status aktualisieren?'
      return 'Alle Teile fertig – bereit zur Lieferung!'
    } else {
      if (suggestedStatus === 'Bezahlt') return 'Bestellung eingegangen – Zahlung bestätigen?'
      if (suggestedStatus === 'In Bearbeitung') return 'Zahlung bestätigt – in Produktion starten?'
      return 'Alle Teile fertig – bereit zur Lieferung!'
    }
  })();

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Status-Workflow</h3>
        {totalParts > 0 && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${allFertig ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
            {fertigParts}/{totalParts} Teile fertig
          </span>
        )}
      </div>

      {/* Suggestion Banner */}
      {suggestedStatus && (
        <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs text-primary flex-1">
            {bannerText}
          </span>
          <button
            onClick={() => {
              if (suggestedStatus === "Geliefert") setShowTrackingInput(true);
              else if (suggestedStatus === "Bezahlt") setShowPaymentDialog(true);
              else commitStatus(suggestedStatus, null);
            }}
            className="text-xs font-semibold text-primary hover:underline whitespace-nowrap"
          >
            Jetzt aktualisieren
          </button>
        </div>
      )}

      {/* Progress Steps */}
      <div className="flex items-center">
        {STATUSES.map((s, i) => {
          const done = currentIdx > i;
          const active = currentIdx === i;
          const allowed = isStepAllowed(s);
          const isLast = i === STATUSES.length - 1;
          const displayLabel = (s === "Geliefert" && lieferart === "abholung") ? "Abgeholt" : s;
          return (
            <React.Fragment key={s}>
              <button
                onClick={() => handleStatusClick(s)}
                disabled={!allowed && !done}
                title={!allowed && !done ? (s === "Geliefert" ? "Alle Teile müssen 'Fertig' sein" : s === "Abgeschlossen" ? "Auftrag muss zuerst geliefert/bezahlt sein" : "") : ""}
                className={`flex flex-col items-center gap-1 transition-all ${
                  done ? "opacity-90" : active ? "opacity-100" : allowed ? "opacity-50 hover:opacity-80" : "opacity-25 cursor-not-allowed"
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all border-2 ${
                  active ? "bg-primary border-primary text-primary-foreground" :
                  done ? "bg-success border-success text-white" :
                  "bg-card border-border text-muted-foreground"
                }`}>
                  {done ? <CheckCircle2 className="w-4 h-4" /> :
                   active ? <Clock className="w-4 h-4" /> :
                   !allowed ? <Lock className="w-3 h-3" /> :
                   s === "Geliefert" ? <Truck className="w-4 h-4" /> :
                   <Circle className="w-4 h-4" />}
                </div>
                <span className={`text-[10px] font-medium whitespace-nowrap ${active ? "text-primary" : done ? "text-success" : "text-muted-foreground"}`}>{displayLabel}</span>
              </button>
              {!isLast && (
                <div className={`flex-1 h-0.5 mb-5 mx-1 transition-all ${done ? "bg-success" : "bg-border"}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Teile-Status Übersicht */}
      {totalParts > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {(["Ausstehend", "In Druck", "Fertig", "Geliefert"] as const).map(s => {
            const count = parts.filter(p => p.status === s).length;
            const colors: Record<string, string> = {
              "Ausstehend": "text-muted-foreground border-border",
              "In Druck": "text-warning border-warning/30 bg-warning/5",
              "Fertig": "text-success border-success/30 bg-success/5",
              "Geliefert": "text-info border-info/30 bg-info/5",
            };
            return (
              <div key={s} className={`border rounded-lg px-2 py-1.5 text-center ${colors[s]}`}>
                <div className="text-lg font-bold">{count}</div>
                <div className="text-[10px]">{s}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tracking-Nr. nachträglich bearbeiten (wenn bereits geliefert) */}
      {!showTrackingInput && (currentStatus === "Geliefert" || currentStatus === "Bezahlt" || currentStatus === "Abgeschlossen") && (
        <div className="flex items-center gap-2 text-xs bg-muted/20 border border-border rounded-lg px-3 py-2">
          <Truck className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">Tracking-Nr.:</span>
          {editingTracking ? (
            <>
              <Input
                value={trackingInput}
                onChange={e => setTrackingInput(e.target.value)}
                placeholder="Tracking-Nummer"
                className="bg-input border-border text-xs h-6 flex-1"
                autoFocus
              />
              <button
                onClick={async () => {
                  await supabase.from("orders").update({ tracking_nr: trackingInput || null } as any).eq("id", orderId);
                  onTrackingNrChange?.(trackingInput);
                  setEditingTracking(false);
                }}
                className="text-xs font-semibold text-primary hover:underline whitespace-nowrap"
              >
                Speichern
              </button>
              <button onClick={() => setEditingTracking(false)} className="text-xs text-muted-foreground hover:underline">Abbrechen</button>
            </>
          ) : (
            <>
              <span className="font-medium text-foreground flex-1">{trackingInput || "—"}</span>
              <button onClick={() => setEditingTracking(true)} className="text-xs text-primary hover:underline whitespace-nowrap">Bearbeiten</button>
            </>
          )}
        </div>
      )}

      {/* Tracking-Nr. Eingabe (bei Lieferung) */}
      {showTrackingInput && (
        <div className="bg-muted/30 border border-primary/20 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold">Lieferung bestätigen</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Tracking-Nummer (optional)</label>
            <Input
              value={trackingInput}
              onChange={e => setTrackingInput(e.target.value)}
              placeholder="z.B. 990123456789012345 (Post CH)"
              className="bg-input border-border text-sm"
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground">Die Nummer wird im Verlauf gespeichert und kann dem Kunden mitgeteilt werden.</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleConfirmDelivery} disabled={savingTracking} className="bg-primary hover:bg-primary/90 gap-2 text-sm" size="sm">
              <Truck className="w-3.5 h-3.5" />
              {savingTracking ? "Speichern..." : "Als geliefert markieren"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowTrackingInput(false)} className="border-border">Abbrechen</Button>
          </div>
        </div>
      )}

      {/* Zahlungs-Bestätigungs-Dialog */}
      {showPaymentDialog && (
        <div className="bg-muted/30 border border-primary/20 rounded-lg p-4 space-y-3">
          <p className="text-sm font-semibold">Wie wurde diese Bestellung bezahlt?</p>
          <div className="space-y-2">
            <button
              onClick={() => handleConfirmPayment("stripe")}
              disabled={savingPayment}
              className="w-full text-left border border-border rounded-lg p-3 hover:border-primary/50 hover:bg-primary/5 transition-colors disabled:opacity-50"
            >
              <div className="text-sm font-medium">Per Stripe (automatisch)</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Stripe-Zahlungen werden normalerweise automatisch erkannt. Nur bestätigen, falls die automatische Erkennung fehlgeschlagen ist.
              </div>
            </button>
            <button
              onClick={() => handleConfirmPayment("rechnung")}
              disabled={savingPayment}
              className="w-full text-left border border-border rounded-lg p-3 hover:border-primary/50 hover:bg-primary/5 transition-colors disabled:opacity-50"
            >
              <div className="text-sm font-medium">Per Rechnung / Überweisung</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Markiert alle offenen Rechnungen dieses Auftrags als bezahlt.
              </div>
            </button>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowPaymentDialog(false)} disabled={savingPayment} className="border-border">Abbrechen</Button>
          </div>
        </div>
      )}

      {/* Verlauf */}
      {!loadingLog && log.length > 0 && (
        <div className="border-t border-border pt-3 space-y-1.5">
          <p className="text-xs text-muted-foreground font-medium mb-2">Verlauf</p>
          {log.slice(0, 6).map(entry => (
            <div key={entry.id} className="flex items-start gap-2 text-xs">
              <span className="text-muted-foreground tabular-nums shrink-0">
                {new Date(entry.created_at).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className="text-foreground font-medium">{entry.status}</span>
              {entry.notiz && <span className="text-muted-foreground">· {entry.notiz}</span>}
            </div>
          ))}
        </div>
      )}

    </div>

  );
}
