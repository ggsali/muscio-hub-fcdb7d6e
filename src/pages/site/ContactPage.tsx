import React, { useState } from "react";
import { Mail, Send, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function ContactPage() {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", email: "", telefon: "", betreff: "", nachricht: "" });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    const { error } = await supabase.from("inquiries").insert({
      name: form.name,
      email: form.email,
      telefon: form.telefon || null,
      betreff: form.betreff || null,
      nachricht: form.nachricht,
      quelle: "website",
    });
    setSending(false);
    if (error) {
      toast({ title: "Senden fehlgeschlagen", description: error.message, variant: "destructive" });
    } else {
      setDone(true);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-12 md:py-16">
      <h1 className="text-3xl md:text-4xl font-bold mb-2">Kontakt</h1>
      <p className="text-muted-foreground mb-10">Schreib uns – wir antworten meist innert 24 Stunden.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-3">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Mail className="w-4 h-4" /> E-Mail
            </div>
            <a href="mailto:info@3dmuscio.com" className="font-medium hover:text-primary">info@3dmuscio.com</a>
          </div>
        </div>

        <div className="md:col-span-2 bg-card border border-border rounded-lg p-6">
          {done ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-3" />
              <h3 className="font-semibold mb-1">Anfrage gesendet</h3>
              <p className="text-sm text-muted-foreground">Wir melden uns zeitnah bei dir.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Name *</Label>
                  <Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="bg-input border-border" />
                </div>
                <div>
                  <Label>E-Mail *</Label>
                  <Input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="bg-input border-border" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Telefon</Label>
                  <Input value={form.telefon} onChange={e => setForm({ ...form, telefon: e.target.value })} className="bg-input border-border" />
                </div>
                <div>
                  <Label>Betreff</Label>
                  <Input value={form.betreff} onChange={e => setForm({ ...form, betreff: e.target.value })} className="bg-input border-border" />
                </div>
              </div>
              <div>
                <Label>Nachricht *</Label>
                <Textarea required rows={6} value={form.nachricht} onChange={e => setForm({ ...form, nachricht: e.target.value })} className="bg-input border-border" />
              </div>
              <Button type="submit" disabled={sending} className="gap-2 w-full md:w-auto">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Anfrage senden
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
