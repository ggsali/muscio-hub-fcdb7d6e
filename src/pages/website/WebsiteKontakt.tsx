import { useState } from "react";
import { Link } from "react-router-dom";
import { ScrollReveal } from "@/components/ScrollReveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Mail, Clock, MessageCircle, ChevronRight, Loader2, Send, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const HUB_ENDPOINT = "https://ukqtjdsjmtxgzhklvqky.supabase.co/functions/v1/submit-inquiry";

const quickFaqs = [
  { q: "Welche Dateiformate akzeptiert ihr?", a: "STL, OBJ, STEP und 3MF Dateien bis 500MB." },
  { q: "Wie schnell erhalte ich mein Teil?", a: "Standardlieferung innerhalb von 48 Stunden nach Bestellbestätigung." },
  { q: "Gibt es Mengenrabatte?", a: "Ab 5 Stück 10%, ab 10 Stück 15% Rabatt auf den Gesamtpreis." },
];

const WebsiteKontakt = () => {
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
        body: JSON.stringify({ name: form.name, email: form.email, telefon: form.phone || null, betreff, nachricht: form.message }),
      });
      if (!res.ok) throw new Error("Fehler beim Senden");
      setSent(true);
      toast.success("Nachricht gesendet! Wir antworten innerhalb 24h.");
      setForm({ name: "", email: "", phone: "", message: "" });
      setBetreff("");
    } catch (err) {
      toast.error("Fehler beim Senden. Bitte schreib uns direkt an info@3dmuscio.ch");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pt-24 pb-16 bg-[#0a0a0a] min-h-screen">
      <div className="container mx-auto px-4">
        <ScrollReveal>
          <div className="text-center mb-12">
            <p className="text-xs font-medium text-[#00cc66] uppercase tracking-widest mb-3">Kontakt</p>
            <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">Kontakt</h1>
            <p className="text-white/50 text-lg">Wir freuen uns auf deine Nachricht</p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 max-w-5xl mx-auto">
          <ScrollReveal className="lg:col-span-3">
            <div className="bg-[#111] rounded-2xl border border-white/8 p-8">
              <h2 className="text-xl font-bold text-white mb-6">Schreib uns</h2>
              {sent ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
                  <CheckCircle2 className="w-12 h-12 text-[#00cc66]" />
                  <p className="font-semibold text-white text-lg">Nachricht erhalten!</p>
                  <p className="text-white/50 text-sm">Wir melden uns innerhalb von 24 Stunden bei dir.</p>
                  <Button variant="outline" size="sm" onClick={() => setSent(false)} className="border-white/10 text-white hover:bg-white/5">
                    Neue Anfrage senden
                  </Button>
                </div>
              ) : (
                <form className="space-y-5" onSubmit={handleSubmit}>
                  <div>
                    <Label className="text-xs font-medium text-white/60">Name *</Label>
                    <Input placeholder="Dein Name" required className="mt-1 bg-white/5 border-white/8 text-white placeholder:text-white/20" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-white/60">E-Mail *</Label>
                    <Input type="email" placeholder="name@beispiel.ch" required className="mt-1 bg-white/5 border-white/8 text-white placeholder:text-white/20" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-white/60">Telefon (optional)</Label>
                    <Input type="tel" placeholder="+41 79..." className="mt-1 bg-white/5 border-white/8 text-white placeholder:text-white/20" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-white/60">Betreff *</Label>
                    <Select value={betreff} onValueChange={setBetreff}>
                      <SelectTrigger className="mt-1 bg-white/5 border-white/8 text-white"><SelectValue placeholder="Bitte wählen" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Anfrage">Anfrage</SelectItem>
                        <SelectItem value="Support">Support</SelectItem>
                        <SelectItem value="Angebot">Angebot</SelectItem>
                        <SelectItem value="Sonstiges">Sonstiges</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-white/60">Nachricht *</Label>
                    <Textarea placeholder="Deine Nachricht..." rows={5} required className="mt-1 bg-white/5 border-white/8 text-white placeholder:text-white/20" value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} />
                  </div>
                  <Button size="lg" type="submit" className="w-full gap-2 bg-[#00cc66] hover:bg-[#00aa55] text-black font-semibold" disabled={submitting}>
                    {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Wird gesendet...</> : <><Send className="w-4 h-4" /> Nachricht senden</>}
                  </Button>
                </form>
              )}
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.1} className="lg:col-span-2">
            <div className="space-y-6">
              <div className="bg-[#111] rounded-2xl border border-white/8 p-8">
                <h2 className="text-xl font-bold text-white mb-6">Kontaktdaten</h2>
                <div className="space-y-5">
                  {[
                    { icon: MapPin, label: "Adresse", value: "Schweiz" },
                    { icon: Mail, label: "E-Mail", value: "info@3dmuscio.ch", href: "mailto:info@3dmuscio.ch" },
                    { icon: Clock, label: "Öffnungszeiten", value: "Mo–Fr: 08:00–18:00\nSa: 09:00–14:00" },
                  ].map(({ icon: Icon, label, value, href }) => (
                    <div key={label} className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-[#00cc66]/10 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5 text-[#00cc66]" />
                      </div>
                      <div>
                        <p className="font-medium text-white text-sm">{label}</p>
                        {href ? (
                          <a href={href} className="text-[#00cc66] text-sm hover:underline">{value}</a>
                        ) : (
                          <p className="text-white/50 text-sm whitespace-pre-line">{value}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 p-4 bg-white/5 rounded-xl flex items-center gap-3">
                  <MessageCircle className="w-5 h-5 text-[#00cc66]" />
                  <div>
                    <p className="text-sm font-medium text-white">Antwort innerhalb 24h</p>
                    <p className="text-xs text-white/40">Garantierte Reaktionszeit</p>
                  </div>
                </div>
              </div>

              <div className="bg-[#111] rounded-2xl border border-white/8 p-8">
                <h3 className="text-lg font-bold text-white mb-4">Häufige Fragen</h3>
                <Accordion type="single" collapsible className="space-y-2">
                  {quickFaqs.map((f, i) => (
                    <AccordionItem key={i} value={`q-${i}`} className="border-none">
                      <AccordionTrigger className="text-sm font-medium text-white hover:no-underline py-3">{f.q}</AccordionTrigger>
                      <AccordionContent className="text-sm text-white/50">{f.a}</AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </div>
  );
};

export default WebsiteKontakt;
