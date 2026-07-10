import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Star, Loader2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";

interface Props {
  orderId: string;
  status: string;
  customerName: string;
  customerEmail?: string;
}

const DEFAULT_SUBJECT = "Vielen Dank für Ihren Auftrag – kurze Bitte";

function buildDefaultBody(name: string) {
  return `Guten Tag ${name || ""},

vielen Dank für Ihren Auftrag bei 3DMuscio – es war uns eine Freude, für Sie zu drucken!

Falls Sie einen Moment Zeit haben, würden wir uns sehr über eine kurze Google-Rezension freuen. Ihr Feedback hilft uns sehr und dauert nur 1–2 Minuten:

👉 [Google Rezension schreiben]

Herzlichen Dank und bis zum nächsten Mal!

Freundliche Grüsse
Jorim Moos
3DMuscio`;
}

export default function ReviewRequestButton({ orderId, status, customerName, customerEmail }: Props) {
  const { toast } = useToast();
  const [reviewUrl, setReviewUrl] = useState<string>("");
  const [alreadySentAt, setAlreadySentAt] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const visible = status === "Abgeschlossen" || status === "Geliefert";

  useEffect(() => {
    if (!visible) return;
    supabase.from("settings").select("value").eq("key", "google_review_url").maybeSingle()
      .then(({ data }) => setReviewUrl(data?.value || ""));
    supabase.from("order_status_log")
      .select("created_at")
      .eq("order_id", orderId)
      .eq("status", "review_request")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setAlreadySentAt(data?.created_at || null));
  }, [orderId, visible]);

  const openModal = () => {
    setSubject(DEFAULT_SUBJECT);
    setBody(buildDefaultBody(customerName));
    setOpen(true);
  };

  const send = async () => {
    if (!customerEmail) {
      toast({ title: "Keine Kunden-E-Mail hinterlegt", variant: "destructive" });
      return;
    }
    if (!reviewUrl) {
      toast({ title: "Kein Google-Link hinterlegt", description: "Bitte in den Einstellungen einen Google Rezensions-Link speichern.", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-review-request", {
        body: {
          order_id: orderId,
          subject,
          body,
          customer_email: customerEmail,
          customer_name: customerName,
          review_url: reviewUrl,
        },
      });
      if (error || data?.success === false) {
        toast({ title: "Fehler beim Senden", description: data?.error || error?.message, variant: "destructive" });
      } else {
        toast({ title: "Rezensions-Anfrage gesendet ✓" });
        setAlreadySentAt(new Date().toISOString());
        setOpen(false);
      }
    } catch (e: any) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    }
    setSending(false);
  };

  if (!visible) return null;

  return (
    <div className="bg-card border border-border rounded-lg p-4 md:p-5 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Star className="w-4 h-4 text-primary" /> Google-Rezension
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Kunden manuell um eine Google-Bewertung bitten.
          </p>
          {alreadySentAt && (
            <p className="text-xs text-success mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Bereits angefragt am {new Date(alreadySentAt).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
        <Button onClick={openModal} variant="outline" className="gap-2 border-border">
          <Star className="w-4 h-4" /> Rezension anfragen
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Rezensions-Anfrage senden</DialogTitle>
            <DialogDescription>
              Vorschau der E-Mail. Text kann vor dem Senden angepasst werden.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Empfänger</Label>
              <Input value={customerEmail || ""} disabled className="bg-input border-border text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Betreff</Label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} className="bg-input border-border text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nachricht</Label>
              <Textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={14}
                className="bg-input border-border text-sm font-mono resize-none"
              />
              <p className="text-[11px] text-muted-foreground">
                Der Platzhalter <code>[Google Rezension schreiben]</code> wird automatisch als klickbarer Link zu {reviewUrl || "(kein Link hinterlegt)"} eingesetzt.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={sending} className="border-border">Abbrechen</Button>
            <Button onClick={send} disabled={sending} className="gap-2">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4" />}
              {sending ? "Wird gesendet..." : "Senden"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
