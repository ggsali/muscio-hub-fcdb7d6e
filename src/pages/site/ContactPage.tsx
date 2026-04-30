import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ScrollReveal } from "@/components/site/ScrollReveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  MapPin, Mail, Clock, MessageCircle, ChevronRight, Loader2, Send, Paperclip, X, FileBox
} from "lucide-react";
import { toast } from "sonner";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger
} from "@/components/ui/accordion";

const quickFaqs = [
  { q: "Welche Dateiformate akzeptiert ihr?", a: "STL, OBJ, STEP und 3MF Dateien bis 500MB." },
  { q: "Wie schnell erhalte ich mein Teil?", a: "Standardlieferung innerhalb von 48 Stunden nach Bestellbestätigung." },
  { q: "Gibt es Mengenrabatte?", a: "Ab 5 Stück 10%, ab 10 Stück 15% Rabatt auf den Gesamtpreis." },
];

const ContactPage = () => {
  const [betreff, setBetreff] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (fl: FileList | null) => {
    if (!fl) return;
    const next = Array.from(fl).filter(f => !attachments.find(a => a.name === f.name));
    setAttachments(p => [...p, ...next]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!betreff) { toast.error("Bitte wähle einen Betreff aus."); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("inquiries").insert({
        name: form.name,
        email: form.email,
        telefon: form.phone || null,
        betreff,
        nachricht: form.message,
        status: "Neu",
        quelle: "website",
      });
      if (error) throw error;
      toast.success("Nachricht gesendet! Wir antworten innerhalb 24h.");
      setForm({ name: "", email: "", phone: "", message: "" });
      setBetreff("");
      setAttachments([]);
    } catch (err) {
      console.error(err);
      toast.error("Fehler beim Senden. Bitte schreib uns direkt an info@3dmuscio.com");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pt-12 pb-16">
      <div className="container mx-auto px-4">
        <ScrollReveal>
          <div className="text-center mb-12">
            <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">Kontakt</p>
            <h1 className="font-heading text-4xl md:text-5xl font-extrabold text-foreground mb-4">Kontakt</h1>
            <p className="text-muted-foreground text-lg">Wir freuen uns auf deine Nachricht</p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 max-w-5xl mx-auto">
          <ScrollReveal className="lg:col-span-3">
            <div className="bg-card rounded-2xl border border-border p-8">
              <h2 className="font-heading text-xl font-bold text-foreground mb-6">Schreib uns</h2>
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div>
                  <Label className="text-xs font-medium">Name *</Label>
                  <Input required className="mt-1" placeholder="Dein Name"
                    value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs font-medium">E-Mail *</Label>
                  <Input type="email" required className="mt-1" placeholder="name@beispiel.ch"
                    value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs font-medium">Telefon (optional)</Label>
                  <Input type="tel" className="mt-1" placeholder="+41 79..."
                    value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
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
                  <Textarea rows={5} required className="mt-1" placeholder="Deine Nachricht..."
                    value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs font-medium">Dateien anhängen (optional)</Label>
                  <input
                    ref={fileInputRef} type="file" multiple
                    accept=".stl,.3mf,.step,.obj,.pdf,.png,.jpg,.jpeg"
                    className="hidden"
                    onChange={e => handleFiles(e.target.files)}
                  />
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="mt-1 w-full flex items-center gap-2 px-4 py-3 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:border-primary/50 hover:bg-muted/30 transition-all">
                    <Paperclip className="w-4 h-4 shrink-0" />
                    Dateien auswählen (STL, 3MF, STEP, OBJ, PDF…)
                  </button>
                  {attachments.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {attachments.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-2 bg-muted/40 rounded-lg">
                          <FileBox className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="text-xs flex-1 truncate">{f.name}</span>
                          <span className="text-xs text-muted-foreground">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                          <button type="button" onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-foreground">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <Button size="lg" type="submit" className="w-full gap-2" disabled={submitting}>
                  {submitting
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Wird gesendet...</>
                    : <><Send className="w-4 h-4" /> Nachricht senden</>}
                </Button>
              </form>
            </div>
          </ScrollReveal>

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
                      <p className="text-muted-foreground text-sm">Gartensiedlung 13, 8360 Eschlikon TG</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Mail className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground text-sm">E-Mail</p>
                      <a href="mailto:info@3dmuscio.com" className="text-primary text-sm hover:underline">info@3dmuscio.com</a>
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
                  Mehr erfahren <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
