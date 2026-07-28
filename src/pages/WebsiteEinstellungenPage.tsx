import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Settings as SettingsIcon, Save, Plus, Trash2, Mail, ExternalLink, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { COLOR_MAP, colorHex } from "@/lib/colorMap";
import { X } from "lucide-react";

interface FaqEntry { frage: string; antwort: string; }
interface MaterialPrice { material: string; preis_pro_g: number; }
interface MaterialRow { id: string; name: string; tag: string; price_per_gram: number; density: number; description: string | null; aktiv: boolean; sort_order: number; farben: string[]; _new?: boolean; }

export default function WebsiteEinstellungenPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [wartung, setWartung] = useState({ aktiv: false, nachricht: "" });
  const [kontakt, setKontakt] = useState({ email: "", telefon: "", adresse: "" });
  const [whatsapp, setWhatsapp] = useState({ nummer: "" });
  const [faq, setFaq] = useState<FaqEntry[]>([]);
  const [preise, setPreise] = useState<MaterialPrice[]>([]);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [karussel, setKarussel] = useState<{ text: string }[]>([]);
  const [savingKarussel, setSavingKarussel] = useState(false);
  const [ueberUnsBild, setUeberUnsBild] = useState<string>("");
  const [uploadingBild, setUploadingBild] = useState(false);

  const reloadMaterials = async () => {
    const { data } = await supabase.from("materials").select("*").order("sort_order");
    if (data) setMaterials(data as MaterialRow[]);
  };

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
          if (row.key === "karussel") {
            const items = ((row.value as any)?.items) as { text: string }[] | undefined;
            if (items && items.length > 0) setKarussel(items);
            else setKarussel([
              { text: "48h Lieferung" },
              { text: "0.1mm Präzision" },
              { text: "Swiss Made" },
              { text: "100+ Kunden" },
            ]);
          }
        }
        if (!data.find(r => r.key === "karussel")) {
          setKarussel([
            { text: "48h Lieferung" },
            { text: "0.1mm Präzision" },
            { text: "Swiss Made" },
            { text: "100+ Kunden" },
          ]);
        }
      }
      await reloadMaterials();
      setLoading(false);
    })();
  }, []);

  const updateMaterial = (id: string, patch: Partial<MaterialRow>) => {
    setMaterials(ms => ms.map(m => m.id === id ? { ...m, ...patch } : m));
  };
  const saveMaterial = async (m: MaterialRow) => {
    const { _new, id, ...rest } = m;
    if (_new) {
      const { error } = await supabase.from("materials").insert({ ...rest });
      if (error) toast({ title: "Fehler", description: error.message, variant: "destructive" });
      else { toast({ title: "Material gespeichert" }); await reloadMaterials(); }
    } else {
      const { error } = await supabase.from("materials").update(rest).eq("id", id);
      if (error) toast({ title: "Fehler", description: error.message, variant: "destructive" });
      else toast({ title: "Material gespeichert" });
    }
  };
  const deleteMaterial = async (m: MaterialRow) => {
    if (!confirm(`Material "${m.name}" wirklich löschen?`)) return;
    if (m._new) { setMaterials(ms => ms.filter(x => x.id !== m.id)); return; }
    const { error } = await supabase.from("materials").delete().eq("id", m.id);
    if (error) toast({ title: "Fehler", description: error.message, variant: "destructive" });
    else { toast({ title: "Gelöscht" }); await reloadMaterials(); }
  };
  const addMaterial = () => {
    setMaterials(ms => [...ms, {
      id: `new-${crypto.randomUUID()}`,
      name: "", tag: "FDM", price_per_gram: 0.05, density: 1.24, farben: [],
      description: "", aktiv: true, sort_order: (ms[ms.length - 1]?.sort_order ?? 0) + 1,
      _new: true,
    }]);
  };

  const saveOne = async (key: string, value: any) => {
    const { error } = await supabase.from("website_settings").upsert({ key, value }, { onConflict: "key" });
    return error;
  };

  const handleSaveAll = async () => {
    setSaving(true);
    const errs = await Promise.all([
      saveOne("wartungsmodus", wartung),
      saveOne("kontakt_info", kontakt),
      saveOne("faq", { eintraege: faq }),
      saveOne("material_preise", { eintraege: preise }),
      saveOne("whatsapp", whatsapp),
    ]);
    setSaving(false);
    if (errs.some(Boolean)) toast({ title: "Fehler beim Speichern", variant: "destructive" });
    else toast({ title: "Einstellungen gespeichert" });
  };

  if (loading) return <div className="p-4 md:p-8 text-center text-muted-foreground text-sm">Laden...</div>;

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

      {/* E-Mail System Status */}
      <section className="bg-card border border-border rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-semibold flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" />
            E-Mail System
          </h3>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-medium border border-green-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Resend aktiv
          </span>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2 text-muted-foreground">
            <span className="text-primary mt-0.5">•</span>
            <span>Auth-Mails (Registrierung, Passwort-Reset, E-Mail-Änderung) via <strong className="text-foreground">Supabase SMTP → Resend</strong></span>
          </div>
          <div className="flex items-start gap-2 text-muted-foreground">
            <span className="text-primary mt-0.5">•</span>
            <span>Transaktionale Mails (Offerten, Rechnungen, Bestellbestätigungen, Status-Updates) via <strong className="text-foreground">Resend Edge Functions</strong> (<code className="text-xs bg-muted px-1 py-0.5 rounded">send-email</code>)</span>
          </div>
          <div className="flex items-start gap-2 text-muted-foreground">
            <span className="text-primary mt-0.5">•</span>
            <span>Absender: <code className="text-xs bg-muted px-1 py-0.5 rounded">noreply@3dmuscio.com</code> · Reply-To: <code className="text-xs bg-muted px-1 py-0.5 rounded">info@3dmuscio.com</code></span>
          </div>
        </div>
        <a
          href="https://resend.com/emails"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline mt-1"
        >
          Resend Logs öffnen
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </section>

      {/* Aufklappbare Sektionen */}
      <Accordion type="multiple" defaultValue={["wartung"]} className="space-y-3">

      {/* Wartungsmodus */}
      <AccordionItem value="wartung" className="bg-card border border-border rounded-lg px-4 md:px-5">
        <AccordionTrigger className="font-semibold hover:no-underline">Wartungsmodus</AccordionTrigger>
        <AccordionContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Wartungsmodus aktiv</span>
            <Switch checked={wartung.aktiv} onCheckedChange={v => setWartung({ ...wartung, aktiv: v })} />
          </div>
          <Textarea
            value={wartung.nachricht}
            onChange={e => setWartung({ ...wartung, nachricht: e.target.value })}
            placeholder="Nachricht für Besucher während Wartung"
            className="bg-input border-border w-full"
          />
        </AccordionContent>
      </AccordionItem>

      {/* Kontakt */}
      <AccordionItem value="kontakt" className="bg-card border border-border rounded-lg px-4 md:px-5">
        <AccordionTrigger className="font-semibold hover:no-underline">Kontakt-Informationen</AccordionTrigger>
        <AccordionContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">E-Mail</label>
              <Input value={kontakt.email} onChange={e => setKontakt({ ...kontakt, email: e.target.value })} className="bg-input border-border w-full" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Telefon</label>
              <Input value={kontakt.telefon} onChange={e => setKontakt({ ...kontakt, telefon: e.target.value })} className="bg-input border-border w-full" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Adresse</label>
            <Textarea value={kontakt.adresse} onChange={e => setKontakt({ ...kontakt, adresse: e.target.value })} className="bg-input border-border w-full" />
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* WhatsApp */}
      <AccordionItem value="whatsapp" className="bg-card border border-border rounded-lg px-4 md:px-5">
        <AccordionTrigger className="font-semibold hover:no-underline">WhatsApp</AccordionTrigger>
        <AccordionContent className="space-y-3">
          <p className="text-xs text-muted-foreground">Nummer für den Chat-Button (Format: 41798395080, ohne + und ohne Leerzeichen). Leer lassen, um WhatsApp im Chat-Button auszublenden.</p>
          <Input
            value={whatsapp.nummer}
            onChange={e => setWhatsapp({ nummer: e.target.value.replace(/[^0-9]/g, "") })}
            placeholder="41798395080"
            className="bg-input border-border w-full"
          />
        </AccordionContent>
      </AccordionItem>

      {/* FAQ */}
      <AccordionItem value="faq" className="bg-card border border-border rounded-lg px-4 md:px-5">
        <AccordionTrigger className="font-semibold hover:no-underline">FAQ-Einträge</AccordionTrigger>
        <AccordionContent className="space-y-3">
          <div className="flex justify-end">
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
                  className="bg-input border-border w-full"
                />
                <button onClick={() => setFaq(faq.filter((_, j) => j !== i))} className="text-destructive p-2 flex-shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <Textarea
                value={entry.antwort}
                onChange={e => setFaq(faq.map((f, j) => j === i ? { ...f, antwort: e.target.value } : f))}
                placeholder="Antwort"
                className="bg-input border-border w-full"
              />
            </div>
          ))}
        </AccordionContent>
      </AccordionItem>

      {/* Materialpreise */}
      <AccordionItem value="materialpreise" className="bg-card border border-border rounded-lg px-4 md:px-5">
        <AccordionTrigger className="font-semibold hover:no-underline">Materialpreise (Website-Anzeige)</AccordionTrigger>
        <AccordionContent className="space-y-3">
          <div className="flex justify-end">
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
                className="bg-input border-border flex-1 min-w-0"
              />
              <Input
                type="number"
                step="0.001"
                value={p.preis_pro_g}
                onChange={e => setPreise(preise.map((x, j) => j === i ? { ...x, preis_pro_g: Number(e.target.value) } : x))}
                placeholder="CHF / g"
                className="bg-input border-border w-24 md:w-32 flex-shrink-0"
              />
              <button onClick={() => setPreise(preise.filter((_, j) => j !== i))} className="text-destructive p-2 flex-shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </AccordionContent>
      </AccordionItem>

      {/* Materialien & Preise (zentral, aus materials-Tabelle) */}
      <AccordionItem value="materialien" className="bg-card border border-border rounded-lg px-4 md:px-5">
        <AccordionTrigger className="font-semibold hover:no-underline">Materialien & Preise</AccordionTrigger>
        <AccordionContent className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs text-muted-foreground">Wird im Kalkulator, auf der Homepage und vom Chatbot genutzt.</p>
            <Button size="sm" variant="outline" onClick={addMaterial} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />Material
            </Button>
          </div>
          <div className="overflow-x-auto -mx-4 md:mx-0">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="text-left p-2">Name</th>
                  <th className="text-left p-2">Tag</th>
                  <th className="text-left p-2">Preis/g</th>
                  <th className="text-left p-2">Dichte</th>
                  <th className="text-left p-2">Beschreibung</th>
                  <th className="text-left p-2">Aktiv</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {materials.map(m => (
                  <React.Fragment key={m.id}>
                  <tr className="border-b border-border/30">
                    <td className="p-1"><Input value={m.name} onChange={e => updateMaterial(m.id, { name: e.target.value })} className="bg-input border-border h-9" /></td>
                    <td className="p-1">
                      <select value={m.tag} onChange={e => updateMaterial(m.id, { tag: e.target.value })} className="h-9 rounded-md border border-border bg-input px-2 text-sm">
                        <option value="FDM">FDM</option>
                        <option value="SLA">SLA</option>
                      </select>
                    </td>
                    <td className="p-1"><Input type="number" step="0.001" value={m.price_per_gram} onChange={e => updateMaterial(m.id, { price_per_gram: Number(e.target.value) })} className="bg-input border-border h-9 w-24" /></td>
                    <td className="p-1"><Input type="number" step="0.01" value={m.density} onChange={e => updateMaterial(m.id, { density: Number(e.target.value) })} className="bg-input border-border h-9 w-20" /></td>
                    <td className="p-1"><Input value={m.description ?? ""} onChange={e => updateMaterial(m.id, { description: e.target.value })} className="bg-input border-border h-9" /></td>
                    <td className="p-1"><Switch checked={m.aktiv} onCheckedChange={v => updateMaterial(m.id, { aktiv: v })} /></td>
                    <td className="p-1 whitespace-nowrap">
                      <Button size="sm" variant="outline" onClick={() => saveMaterial(m)}>Speichern</Button>
                      <button onClick={() => deleteMaterial(m)} className="text-destructive p-2 ml-1"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                  <tr className="border-b border-border/50 bg-muted/20">
                    <td colSpan={7} className="p-3">
                      <FarbenEditor
                        farben={m.farben || []}
                        onChange={(farben) => updateMaterial(m.id, { farben })}
                      />
                    </td>
                  </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Marquee / Ticker */}
      <AccordionItem value="ticker" className="bg-card border border-border rounded-lg px-4 md:px-5">
        <AccordionTrigger className="font-semibold hover:no-underline">Ticker / Marquee</AccordionTrigger>
        <AccordionContent className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-muted-foreground">
              ℹ️ Materialien werden automatisch synchronisiert.
            </p>
            <Button
              size="sm"
              disabled={savingKarussel}
              onClick={async () => {
                setSavingKarussel(true);
                const cleaned = karussel.map(i => ({ text: i.text.trim() })).filter(i => i.text);
                const err = await saveOne("karussel", { items: cleaned });
                setSavingKarussel(false);
                if (err) toast({ title: "Fehler", description: err.message, variant: "destructive" });
                else toast({ title: "Ticker gespeichert" });
              }}
              className="gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              {savingKarussel ? "Speichert..." : "Speichern"}
            </Button>
          </div>
          {karussel.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={item.text}
                onChange={e => setKarussel(karussel.map((x, j) => j === i ? { text: e.target.value } : x))}
                placeholder="z.B. 48h Lieferung"
                className="bg-input border-border flex-1 min-w-0"
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  if (i === 0) return;
                  const next = [...karussel];
                  [next[i - 1], next[i]] = [next[i], next[i - 1]];
                  setKarussel(next);
                }}
                disabled={i === 0}
                className="flex-shrink-0"
              >
                ↑
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  if (i === karussel.length - 1) return;
                  const next = [...karussel];
                  [next[i + 1], next[i]] = [next[i], next[i + 1]];
                  setKarussel(next);
                }}
                disabled={i === karussel.length - 1}
                className="flex-shrink-0"
              >
                ↓
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setKarussel(karussel.filter((_, j) => j !== i))}
                className="flex-shrink-0"
              >
                <X className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setKarussel([...karussel, { text: "" }])}
            className="gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />Eintrag hinzufügen
          </Button>
        </AccordionContent>
      </AccordionItem>

      {/* Benachrichtigungen */}
      <AccordionItem value="benachrichtigungen" className="bg-card border border-border rounded-lg px-4 md:px-5">
        <AccordionTrigger className="font-semibold hover:no-underline">Benachrichtigungen</AccordionTrigger>
        <AccordionContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Wenn ein Kunde im Live-Chat auf "Mit Team sprechen" klickt, wird eine E-Mail an <strong>info@3dmuscio.com</strong> gesendet — aber nur während der Öffnungszeiten.
          </p>
          <div className="bg-muted/30 border border-border rounded-md p-4 text-sm space-y-1">
            <div className="flex justify-between"><span className="font-medium">Mo–Fr</span><span>08:00–18:00</span></div>
            <div className="flex justify-between"><span className="font-medium">Sa</span><span>09:00–14:00</span></div>
            <div className="flex justify-between text-muted-foreground"><span className="font-medium">So</span><span>Geschlossen</span></div>
          </div>
          <p className="text-xs text-muted-foreground">
            ℹ️ Benachrichtigungen werden nur während dieser Zeiten gesendet. Ausserhalb erhält der Kunde im Chat einen Hinweis auf die Öffnungszeiten.
          </p>
        </AccordionContent>
      </AccordionItem>

      </Accordion>
    </div>
  );
}

function FarbenEditor({ farben, onChange }: { farben: string[]; onChange: (f: string[]) => void }) {
  const [input, setInput] = useState("");
  const add = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || farben.includes(trimmed)) return;
    onChange([...farben, trimmed]);
    setInput("");
  };
  const remove = (name: string) => onChange(farben.filter(f => f !== name));
  const suggestions = Object.keys(COLOR_MAP).filter(c => !farben.includes(c));
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">Verfügbare Farben</div>
      <div className="flex flex-wrap gap-1.5">
        {farben.length === 0 && <span className="text-xs text-muted-foreground italic">Keine Farben hinterlegt</span>}
        {farben.map(name => (
          <span key={name} className="inline-flex items-center gap-1.5 pl-1.5 pr-1 py-0.5 rounded-full border border-border bg-background text-xs">
            <span className="w-3 h-3 rounded-full border border-border" style={{ backgroundColor: colorHex(name) }} />
            {name}
            <button type="button" onClick={() => remove(name)} className="hover:text-destructive p-0.5">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <Input
          list="farben-suggestions"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(input); } }}
          placeholder="Farbname (z.B. Weiss)"
          className="bg-input border-border h-8 text-sm max-w-xs"
        />
        <datalist id="farben-suggestions">
          {suggestions.map(s => <option key={s} value={s} />)}
        </datalist>
        <Button type="button" size="sm" variant="outline" onClick={() => add(input)}>Hinzufügen</Button>
      </div>
    </div>
  );
}
