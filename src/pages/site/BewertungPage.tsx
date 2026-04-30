import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Star, CheckCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

export default function BewertungPage() {
  const { token } = useParams<{ token: string }>();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stars, setStars] = useState(5);
  const [hoverStars, setHoverStars] = useState(0);
  const [form, setForm] = useState({ name: "", email: "", kommentar: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.kommentar.trim()) return;
    setSubmitting(true);
    try {
      await supabase.from("reviews").insert({
        customer_name: form.name.trim(),
        customer_email: form.email.trim() || null,
        kommentar: form.kommentar.trim(),
        rating: stars,
        token: token || null,
        source: "website",
        freigegeben: false,
      });
      setSubmitted(true);
    } finally { setSubmitting(false); }
  };

  if (submitted) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center bg-background">
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <CheckCircle className="w-8 h-8 text-primary" />
        </div>
        <h1 className="font-heading text-2xl font-bold text-foreground mb-2">Danke für deine Bewertung!</h1>
        <p className="text-muted-foreground text-sm max-w-xs mb-6">Sie wird nach kurzer Prüfung auf unserer Website veröffentlicht.</p>
        <Link to="/" className="text-primary text-sm font-medium flex items-center gap-1 hover:underline">
          <ArrowLeft className="w-3.5 h-3.5" /> Zur Startseite
        </Link>
      </motion.div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-16">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-xs font-medium text-primary uppercase tracking-widest mb-2">3DMuscio</p>
          <h1 className="font-heading text-2xl font-bold text-foreground mb-2">Bewertung hinterlassen</h1>
          <p className="text-muted-foreground text-sm">Teile deine Erfahrung — es dauert weniger als 1 Minute.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <div className="flex flex-col items-center gap-2">
            <Label className="text-sm text-muted-foreground">Deine Bewertung</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(i => (
                <button key={i} type="button" onMouseEnter={() => setHoverStars(i)} onMouseLeave={() => setHoverStars(0)} onClick={() => setStars(i)} className="transition-transform hover:scale-110">
                  <Star className={`w-8 h-8 transition-colors ${i <= (hoverStars || stars) ? "fill-primary text-primary" : "text-border"}`} />
                </button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">{["", "Mangelhaft", "Ausreichend", "Gut", "Sehr gut", "Hervorragend"][hoverStars || stars]}</span>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Dein Name *</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="z.B. Max Muster" required />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">E-Mail <span className="text-muted-foreground">(optional)</span></Label>
            <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="max@example.com" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Deine Bewertung *</Label>
            <Textarea value={form.kommentar} onChange={e => setForm(f => ({ ...f, kommentar: e.target.value }))} placeholder="Erzähl uns von deiner Erfahrung..." rows={4} required className="resize-none" />
          </div>

          <Button type="submit" className="w-full" disabled={submitting || !form.name.trim() || !form.kommentar.trim()}>
            {submitting ? "Wird gesendet..." : "Bewertung abschicken"}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
