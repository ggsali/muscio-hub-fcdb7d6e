import { useEffect, useState } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Gift, Mail, Clock, ShieldCheck, Loader2, CheckCircle2 } from "lucide-react";

const PRESETS = [25, 50, 100];

export default function GutscheinKaufenPage() {
  const [betrag, setBetrag] = useState(50);
  const [custom, setCustom] = useState("");
  const [empfaengerEmail, setEmpfaengerEmail] = useState("");
  const [empfaengerName, setEmpfaengerName] = useState("");
  const [nachricht, setNachricht] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [erfolg, setErfolg] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("erfolg") === "1") setErfolg(true);
  }, []);

  const finalBetrag = custom ? Math.round(Number(custom) * 100) / 100 : betrag;

  const fetchClientSecret = async (): Promise<string> => {
    const { data, error } = await supabase.functions.invoke("create-shop-checkout", {
      body: {
        environment: getStripeEnvironment(),
        gutschein: {
          betrag: finalBetrag,
          empfaenger_email: empfaengerEmail.trim() || null,
          empfaenger_name: empfaengerName.trim() || null,
          nachricht: nachricht.trim() || null,
        },
        returnUrl: `${window.location.origin}/gutschein?erfolg=1`,
      },
    });
    if (error || !data?.clientSecret) {
      const msg = error?.message || data?.error || "Checkout konnte nicht gestartet werden";
      toast.error(msg);
      throw new Error(msg);
    }
    return data.clientSecret as string;
  };

  const start = () => {
    if (!finalBetrag || finalBetrag < 10) return toast.error("Mindestbetrag CHF 10.–");
    if (finalBetrag > 1000) return toast.error("Maximalbetrag CHF 1'000.–");
    if (empfaengerEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(empfaengerEmail.trim())) {
      return toast.error("Bitte gültige Empfänger-E-Mail eingeben.");
    }
    setStarting(true);
    setCheckoutOpen(true);
    setStarting(false);
  };

  if (erfolg) {
    return (
      <div className="container mx-auto px-4 py-24 max-w-xl text-center">
        <CheckCircle2 className="w-14 h-14 text-success mx-auto mb-4" />
        <h1 className="font-heading text-3xl font-bold mb-3">Gutschein unterwegs!</h1>
        <p className="text-muted-foreground">
          Vielen Dank für deinen Kauf. Der Gutschein-Code wurde per E-Mail versendet – prüfe
          auch den Spam-Ordner, falls er nicht sofort ankommt.
        </p>
        <Button className="mt-6" onClick={() => { setErfolg(false); window.history.replaceState({}, "", "/gutschein"); }}>
          Weiteren Gutschein kaufen
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-14 md:py-20 max-w-3xl">
      <div className="text-center mb-10">
        <span className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-primary font-semibold">
          <Gift className="w-4 h-4" /> Geschenkidee
        </span>
        <h1 className="font-heading text-3xl md:text-4xl font-extrabold mt-3">3D-Druck Gutschein kaufen</h1>
        <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
          Verschenke individuelle 3D-Drucke aus der Schweiz. Der Code kommt sofort per E-Mail
          und ist 12 Monate gültig – einlösbar im Shop und im Online-Kalkulator.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
        {[
          { icon: Mail, text: "Sofort per E-Mail" },
          { icon: Clock, text: "12 Monate gültig" },
          { icon: ShieldCheck, text: "Sichere Zahlung" },
        ].map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-3 text-sm">
            <Icon className="w-4 h-4 text-primary" /> {text}
          </div>
        ))}
      </div>

      {checkoutOpen ? (
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center justify-between mb-4">
            <p className="font-semibold">Gutschein CHF {finalBetrag.toFixed(2)}</p>
            <Button variant="ghost" size="sm" onClick={() => setCheckoutOpen(false)}>Zurück</Button>
          </div>
          <div className="min-h-[500px]">
            <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl p-5 md:p-6 space-y-5">
          <div>
            <Label className="text-xs">Betrag wählen</Label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => { setBetrag(p); setCustom(""); }}
                  className={`rounded-xl border px-4 py-3 font-bold transition-colors ${
                    !custom && betrag === p
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  CHF {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs">Wunschbetrag (CHF 10 – 1'000)</Label>
            <Input
              type="number" min="10" max="1000" step="1" className="mt-1 text-base"
              placeholder="z.B. 75"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
            />
          </div>

          <div className="border-t border-border pt-5 space-y-4">
            <p className="text-sm font-semibold">Empfänger (optional)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Name</Label>
                <Input className="mt-1 text-base" value={empfaengerName} onChange={(e) => setEmpfaengerName(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">E-Mail</Label>
                <Input type="email" className="mt-1 text-base" value={empfaengerEmail} onChange={(e) => setEmpfaengerEmail(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Persönliche Nachricht</Label>
              <Textarea rows={3} className="mt-1 text-base" value={nachricht} onChange={(e) => setNachricht(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">
              Ohne Empfänger-E-Mail senden wir den Gutschein an die Adresse, die du beim Bezahlen angibst.
            </p>
          </div>

          <Button className="w-full gap-2" onClick={start} disabled={starting}>
            {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
            Gutschein für CHF {finalBetrag ? finalBetrag.toFixed(2) : "0.00"} kaufen
          </Button>
        </div>
      )}
    </div>
  );
}
