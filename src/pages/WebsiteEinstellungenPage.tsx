import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Settings as SettingsIcon, Save, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

interface FaqEntry { frage: string; antwort: string; }
interface MaterialPrice { material: string; preis_pro_g: number; }

export default function WebsiteEinstellungenPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [wartung, setWartung] = useState({ aktiv: false, nachricht: "" });
  const [kontakt, setKontakt] = useState({ email: "", telefon: "", adresse: "" });
  const [whatsapp, setWhatsapp] = useState({ nummer: "" });
  const [faq, setFaq] = useState<FaqEntry[]>([]);
  const [preise, setPreise] = useState<MaterialPrice[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("website_settings").select("*");
      if (data) {
        for (const row of data) {
          if (row.key === "wartungsmodus") setWartung(row.value as any);
          if (row.key === "kontakt_info") setKontakt(row.value as any);
          if (row.key === "faq") setFaq(((row.value as any).eintraege) || []);
          if (row.key === "material_preise") setPreise(((row.value as any).eintraege) || []);
          if (row.key === "whatsapp") setWhatsapp({ nummer: (row.value as any)?.nummer || "" });
        }
      }
      setLoading(false);
    })();
  }, []);

  const saveOne = async (key: string, value: any) => {
    const { error } = await supabase.from("website_settings").update({ value }).eq("key", key);
    return error;
  };

  const handleSaveAll = async () => {
    setSaving(true);
    const errs = await Promise.all([
      saveOne("wartungsmodus", wartung),
      saveOne("kontakt_info", kontakt),
      saveOne("faq", { eintraege: faq }),
      saveOne("material_preise", { eintraege: preise }),
    ]);
    setSaving(false);
    if (errs.some(Boolean)) toast({ title: "Fehler beim Speichern", variant: "destructive" });
    else toast({ title: "Einstellungen gespeichert" });
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground text-sm">Laden...</div>;

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-primary" />
            Website-Einstellungen
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Wartungsmodus, Kontakt, FAQ, Materialpreise</p>
        </div>
        <Button onClick={handleSaveAll} disabled={saving} className="gap-2">
          <Save className="w-4 h-4" />
          {saving ? "Speichert..." : "Alles speichern"}
        </Button>
      </div>

      {/* Wartungsmodus */}
      <section className="bg-card border border-border rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Wartungsmodus</h3>
          <Switch checked={wartung.aktiv} onCheckedChange={v => setWartung({ ...wartung, aktiv: v })} />
        </div>
        <Textarea
          value={wartung.nachricht}
          onChange={e => setWartung({ ...wartung, nachricht: e.target.value })}
          placeholder="Nachricht für Besucher während Wartung"
          className="bg-input border-border"
        />
      </section>

      {/* Kontakt */}
      <section className="bg-card border border-border rounded-lg p-5 space-y-3">
        <h3 className="font-semibold">Kontakt-Informationen</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">E-Mail</label>
            <Input value={kontakt.email} onChange={e => setKontakt({ ...kontakt, email: e.target.value })} className="bg-input border-border" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Telefon</label>
            <Input value={kontakt.telefon} onChange={e => setKontakt({ ...kontakt, telefon: e.target.value })} className="bg-input border-border" />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Adresse</label>
          <Textarea value={kontakt.adresse} onChange={e => setKontakt({ ...kontakt, adresse: e.target.value })} className="bg-input border-border" />
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-card border border-border rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">FAQ-Einträge</h3>
          <Button size="sm" variant="outline" onClick={() => setFaq([...faq, { frage: "", antwort: "" }])} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />Eintrag
          </Button>
        </div>
        {faq.length === 0 && <p className="text-xs text-muted-foreground">Keine Einträge</p>}
        {faq.map((entry, i) => (
          <div key={i} className="border border-border rounded p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Input
                value={entry.frage}
                onChange={e => setFaq(faq.map((f, j) => j === i ? { ...f, frage: e.target.value } : f))}
                placeholder="Frage"
                className="bg-input border-border"
              />
              <button onClick={() => setFaq(faq.filter((_, j) => j !== i))} className="text-destructive p-2">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <Textarea
              value={entry.antwort}
              onChange={e => setFaq(faq.map((f, j) => j === i ? { ...f, antwort: e.target.value } : f))}
              placeholder="Antwort"
              className="bg-input border-border"
            />
          </div>
        ))}
      </section>

      {/* Materialpreise */}
      <section className="bg-card border border-border rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Materialpreise (Website-Anzeige)</h3>
          <Button size="sm" variant="outline" onClick={() => setPreise([...preise, { material: "", preis_pro_g: 0 }])} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />Material
          </Button>
        </div>
        {preise.length === 0 && <p className="text-xs text-muted-foreground">Keine Einträge</p>}
        {preise.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={p.material}
              onChange={e => setPreise(preise.map((x, j) => j === i ? { ...x, material: e.target.value } : x))}
              placeholder="z.B. PLA Standard"
              className="bg-input border-border flex-1"
            />
            <Input
              type="number"
              step="0.001"
              value={p.preis_pro_g}
              onChange={e => setPreise(preise.map((x, j) => j === i ? { ...x, preis_pro_g: Number(e.target.value) } : x))}
              placeholder="CHF / g"
              className="bg-input border-border w-32"
            />
            <button onClick={() => setPreise(preise.filter((_, j) => j !== i))} className="text-destructive p-2">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
