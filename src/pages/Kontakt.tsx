import { useState } from "react";
import { Link } from "react-router-dom";
// @ts-ignore
import { ScrollReveal } from "@/components/ScrollReveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MapPin, Mail, Clock, MessageCircle, ChevronRight, Loader2, Send, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";

// Sendet Anfragen direkt in den 3DMuscio Hub
const HUB_ENDPOINT = "https://ukqtjdsjmtxgzhklvqky.supabase.co/functions/v1/submit-inquiry";

const quickFaqs = [
  { q: "Welche Dateiformate akzeptiert ihr?", a: "STL, OBJ, STEP und 3MF Dateien bis 500MB." },
  { q: "Wie schnell erhalte ich mein Teil?", a: "Standardlieferung innerhalb von 48 Stunden nach Bestellbestätigung." },
  { q: "Gibt es Mengenrabatte?", a: "Ab 5 Stück 10%, ab 10 Stück 15% Rabatt auf den Gesamtpreis." },
];

const Kontakt = () => {
  const [betreff, setBetreff] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!betreff) { toast.error("Bitte wähle einen Betreff aus."); return; }
    setSubmitting(true);
    try {
      const res = await fetch(HUB_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          telefon: form.phone || null,
          betreff,
          nachricht: form.message,
        }),
      });
      if (!res.ok) throw new Error("Fehler beim Senden");
      setSent(true);
      toast.success("Nachricht gesendet! Wir antworten innerhalb 24h.");
      setForm({ name: "", email: "", phone: "", message: "" });
      setBetreff("");
    } catch (err) {
      console.error(err);
      toast.error("Fehler beim Senden. Bitte schreib uns direkt an info@3dmuscio.ch");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pt-24 pb-16">
      <div className="container mx-auto px-4">
        <ScrollReveal>
          <div className="text-center mb-12">
            <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">Kontakt</p>
            <h1 className="font-heading text-4xl md:text-5xl font-extrabold text-foreground mb-4">Kontakt</h1>
            <p className="text-muted-foreground text-lg">Wir freuen uns auf deine Nachricht</p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 max-w-5xl mx-auto">
          {/* Form */}
          <ScrollReveal className="lg:col-span-3">
            <div className="bg-card rounded-2xl border border-border p-8">
              <h2 className="font-heading text-xl font-bold text-foreground mb-6">Schreib uns</h2>

              {sent ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
                  <CheckCircle2 className="w-12 h-12 text-primary" />
                  <p className="font-semibold text-foreground text-lg">Nachricht erhalten!</p>
                  <p className="text-muted-foreground text-sm">Wir melden uns innerhalb von 24 Stunden bei dir.</p>
                  <Button variant="outline" size="sm" onClick={() => setSent(false)}>
                    Neue Anfrage senden
                  </Button>
                </div>
              ) : (
                <form className="space-y-5" onSubmit={handleSubmit}>
                  <div>
                    <Label className="text-xs font-medium">Name *</Label>
                    <Input
                      placeholder="Dein Name"
                      required
                      className="mt-1"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">E-Mail *</Label>
                    <Input
                      type="email"
                      placeholder="name@beispiel.ch"
                      required
                      className="mt-1"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Telefon (optional)</Label>
                    <Input
                      type="tel"
                      placeholder="+41 79..."
                      className="mt-1"
                      value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Betreff *</Label>
                    <Select value={betreff} onValueChange={setBetreff}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Bitte wählen" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Anfrage">Anfrage</SelectItem>
                        <SelectItem value="Support">Support</SelectItem>
                        <SelectItem value="Angebot">Angebot</SelectItem>
                        <SelectItem value="Sonstiges">Sonstiges</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Nachricht *</Label>
                    <Textarea
                      placeholder="Deine Nachricht..."
                      rows={5}
                      required
                      className="mt-1"
                      value={form.message}
                      onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                    />
                  </div>
                  <Button variant="hero" size="lg" type="submit" className="w-full gap-2" disabled={submitting}>
                    {submitting ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Wird gesendet...</>
                    ) : (
                      <><Send className="w-4 h-4" /> Nachricht senden</>
                    )}
                  </Button>
                </form>
              )}
            </div>
          </ScrollReveal>

          {/* Info */}
          <ScrollReveal delay={0.1} className="lg:col-span-2">
            <div className="space-y-6">
              <div className="bg-card rounded-2xl border border-border p-8">
                <h2 className="font-heading text-xl font-bold text-foreground mb-6">Kontaktdaten</h2>
                <div className="space-y-5">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <MapPin className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground text-sm">Adresse</p>
                      <p className="text-muted-foreground text-sm">Schweiz</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Mail className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground text-sm">E-Mail</p>
                      <a href="mailto:info@3dmuscio.ch" className="text-primary text-sm hover:underline">info@3dmuscio.ch</a>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Clock className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground text-sm">Öffnungszeiten</p>
                      <p className="text-muted-foreground text-sm">Mo–Fr: 08:00–18:00<br />Sa: 09:00–14:00</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-muted rounded-xl flex items-center gap-3">
                  <MessageCircle className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Antwort innerhalb 24h</p>
                    <p className="text-xs text-muted-foreground">Garantierte Reaktionszeit</p>
                  </div>
                </div>
              </div>

              {/* Quick FAQ */}
              <div className="bg-card rounded-2xl border border-border p-8">
                <h3 className="font-heading text-lg font-bold text-foreground mb-4">Häufige Fragen</h3>
                <Accordion type="single" collapsible className="space-y-2">
                  {quickFaqs.map((f, i) => (
                    <AccordionItem key={i} value={`q-${i}`} className="border-none">
                      <AccordionTrigger className="text-sm font-medium text-foreground hover:no-underline py-3">{f.q}</AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
                <Link to="/" className="text-sm text-primary font-medium flex items-center gap-1 mt-4">
                  Alle FAQ ansehen <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </div>
  );
};

export default Kontakt;
