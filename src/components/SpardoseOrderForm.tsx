import { useEffect, useState } from "react";
import { Loader2, Send, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PlatePlan } from "@/lib/spardosePlate";
import type { SpardoseParams } from "@/lib/spardose";

// Bestellformular des Spardose-Generators: gleiche Kontaktdaten-Abfrage wie im Online-Kalkulator,
// sendet eine Anfrage (submit-inquiry) mit den fertigen Druckplatten als Anhang -> erscheint im Admin unter Anfragen.
type Props = {
  params: SpardoseParams;
  plans: PlatePlan[];
  jobs: { label: string; hex: string; count: number; min: number; g: number; gcodePath?: string; gcodeSize?: number }[];
  preis: number;
  colors: { text: string; base: string; cap: string };
  labelOf: (hex: string) => string;
};

const EMPTY = { vorname: "", nachname: "", email: "", phone: "", strasse: "", plz: "", ort: "", land: "Schweiz", message: "" };

export default function SpardoseOrderForm({ params, plans, jobs, preis, colors, labelOf }: Props) {
  const [form, setForm] = useState(EMPTY);
  const [needAddress, setNeedAddress] = useState(true); // Adresse nur weglassen, wenn sie beim eingeloggten Kunden schon gespeichert ist
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: cust } = await supabase.from("customers").select("strasse, plz, ort, land").eq("auth_user_id", user.id).maybeSingle();
      if (cust?.strasse && cust?.plz && cust?.ort) {
        setNeedAddress(false);
      } else if (cust) {
        setForm((f) => ({ ...f, strasse: cust.strasse || "", plz: cust.plz || "", ort: cust.ort || "", land: cust.land || "Schweiz" }));
      }
      const { data: profile } = await supabase.from("profiles").select("full_name, phone").eq("user_id", user.id).maybeSingle();
      const fullName = profile?.full_name || (user.user_metadata?.full_name as string) || "";
      const ps = fullName.trim().split(/\s+/);
      setForm((f) => ({
        ...f,
        vorname: ps[0] || "",
        nachname: ps.slice(1).join(" ") || "",
        email: user.email || "",
        phone: profile?.phone || (user.user_metadata?.phone as string) || "",
      }));
    })();
  }, []);

  const set = (k: keyof typeof EMPTY, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let vorname = form.vorname.trim(), nachname = form.nachname.trim(), email = form.email.trim();
      if (user) {
        if (!email) email = user.email || "";
        if (!vorname && !nachname) vorname = user.email || "Kunde";
      }
      const name = `${vorname} ${nachname}`.trim() || email || "Kunde";

      // Druckplatten hochladen (öffentlicher Ordner kalkulator/, wie im Online-Kalkulator)
      const id = crypto.randomUUID().slice(0, 8);
      const safeName = params.name.replace(/[^a-zA-Z0-9]/g, "") || "name";
      const attachments: Record<string, unknown>[] = [];
      for (let i = 0; i < plans.length; i++) {
        const pl = plans[i];
        const path = `kalkulator/spardose-${id}-${safeName}-platte${i + 1}.stl`;
        const { error } = await supabase.storage.from("project-uploads").upload(path, pl.blob, { upsert: false, contentType: "model/stl" });
        if (error) throw error;
        attachments.push({ filename: `Spardose ${params.name} – Platte ${i + 1} (${pl.label}).stl`, storage_path: path, size_bytes: pl.blob.size, bucket: "project-uploads", menge: 1, material: "PLA", farbe: pl.label });
        const gj = jobs[i];
        if (gj?.gcodePath) attachments.push({ filename: `Spardose ${params.name} – Platte ${i + 1} (${pl.label}) geslict.gcode`, storage_path: gj.gcodePath, size_bytes: gj.gcodeSize ?? null, bucket: "project-uploads", kind: "gcode", menge: 1, material: "PLA", farbe: pl.label });
      }

      const platten = jobs.map((j, i) => `Platte ${i + 1}: ${j.label} – ${j.count} Teil${j.count === 1 ? "" : "e"}, ${Math.floor(j.min / 60)} h ${Math.round(j.min % 60)} min, ${j.g.toFixed(0)} g`).join("\n");
      const addressLine = needAddress && (form.strasse || form.plz || form.ort) ? `\n\nAdresse: ${form.strasse}, ${form.plz} ${form.ort}, ${form.land}` : "";
      const nachricht =
        `SPARDOSE-BESTELLUNG\nName auf der Spardose: ${params.name}\nSchrift: ${params.font}\n` +
        `Farben: Buchstaben ${labelOf(colors.text)}, Körper ${labelOf(colors.base)}, Kappe ${labelOf(colors.cap)}\nMaterial: PLA\n\n${platten}\n\n` +
        `Geschätzter Gesamtpreis: CHF ${preis.toFixed(2)}${addressLine}\n\nNachricht: ${form.message}\n\n` +
        `Konfiguration (JSON): ${JSON.stringify(params)}`;

      const { data, error } = await supabase.functions.invoke("submit-inquiry", {
        body: {
          name, email,
          telefon: form.phone.trim() || null,
          betreff: `Spardose-Bestellung: ${params.name}`,
          nachricht,
          strasse: needAddress ? form.strasse || null : null, plz: needAddress ? form.plz || null : null, ort: needAddress ? form.ort || null : null, land: form.land || "Schweiz",
          attachments,
        },
      });
      if (error || !data?.success) throw new Error(error?.message || data?.error || "Fehler beim Senden");
      toast.success(data?.ferien?.bis
        ? `Bestellung gesendet! Wir sind bis ${(data.ferien.bis as string).split("-").reverse().join(".")} in den Ferien und melden uns danach.`
        : "Bestellung gesendet! Wir melden uns innerhalb 24h.");
      setDone(true);
    } catch (err) {
      console.error(err);
      toast.error("Fehler beim Senden – bitte später erneut versuchen.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div><div className="font-semibold">Danke für deine Bestellung!</div><div className="text-muted-foreground">Die Anfrage mit den fertigen Druckplatten liegt im Admin unter Anfragen. Du erhältst eine Bestätigung per E-Mail.</div></div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border bg-card p-5">
      <h3 className="text-lg font-bold">Deine Kontaktdaten</h3>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Vorname *</Label><Input required value={form.vorname} onChange={(e) => set("vorname", e.target.value)} className="mt-1 text-base" /></div>
        <div><Label className="text-xs">Nachname *</Label><Input required value={form.nachname} onChange={(e) => set("nachname", e.target.value)} className="mt-1 text-base" /></div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div><Label className="text-xs">E-Mail *</Label><Input type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} className="mt-1 text-base" /></div>
        <div><Label className="text-xs">Telefon *</Label><Input type="tel" required value={form.phone} onChange={(e) => set("phone", e.target.value)} className="mt-1 text-base" /></div>
      </div>
      {needAddress && (
        <>
          <div><Label className="text-xs">Strasse & Hausnummer *</Label><Input required value={form.strasse} onChange={(e) => set("strasse", e.target.value)} className="mt-1 text-base" /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs">PLZ *</Label><Input required value={form.plz} onChange={(e) => set("plz", e.target.value)} className="mt-1 text-base" /></div>
            <div className="col-span-2"><Label className="text-xs">Ort *</Label><Input required value={form.ort} onChange={(e) => set("ort", e.target.value)} className="mt-1 text-base" /></div>
          </div>
          <div><Label className="text-xs">Land</Label><Input value={form.land} onChange={(e) => set("land", e.target.value)} className="mt-1 text-base" /></div>
        </>
      )}
      <div><Label className="text-xs">Nachricht (optional)</Label><Textarea rows={3} value={form.message} onChange={(e) => set("message", e.target.value)} className="mt-1 text-base" /></div>
      <Button type="submit" className="w-full gap-2" disabled={submitting}>
        {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Wird gesendet...</> : <><Send className="h-4 w-4" /> Jetzt bestellen</>}
      </Button>
      <p className="text-center text-xs text-muted-foreground">Preise sind Schätzungen. Verbindliches Angebot innerhalb 24h.</p>
    </form>
  );
}
