import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Save, Wand2 } from "lucide-react";

type Row = { tag: number; titel: string; text: string; typ: string; wert: string };
const TYPEN = [
  { v: "", l: "Kein Code (nur Tipp)" },
  { v: "prozent", l: "Prozent-Rabatt" },
  { v: "betrag", l: "Betrag CHF" },
  { v: "gratis_versand", l: "Gratis Versand" },
];
const jahr = new Date().getFullYear();
const codeFor = (tag: number) => `ADVENT${jahr}-${String(tag).padStart(2, "0")}`;
const empty = (): Row[] => Array.from({ length: 24 }, (_, i) => ({ tag: i + 1, titel: "", text: "", typ: "", wert: "" }));

/** Vorschlag: kleine Rabatte, Sonntage/Sonderzahlen etwas grösser. */
const suggestion = (): Row[] =>
  empty().map((r) => {
    if (r.tag === 24) return { ...r, titel: "Weihnachts-Überraschung", text: "Zum Schluss ein grosses Dankeschön.", typ: "prozent", wert: "15" };
    if (r.tag % 6 === 0) return { ...r, titel: "Gratis Versand", text: "Heute ohne Versandkosten.", typ: "gratis_versand", wert: "0" };
    if (r.tag % 5 === 0) return { ...r, titel: "10 % auf alles", text: "Nur für kurze Zeit.", typ: "prozent", wert: "10" };
    if (r.tag % 2 === 0) return { ...r, titel: "5 % Rabatt", text: "Ein kleines Dankeschön.", typ: "prozent", wert: "5" };
    return { ...r, titel: "Geschenkidee des Tages", text: "Schau heute im Shop vorbei, vielleicht ist das Richtige dabei.", typ: "", wert: "" };
  });

export function AdventAdmin() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>(empty());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("advent_tuerchen" as any).select("tag,titel,text,typ,wert").eq("jahr", jahr);
      if (data && data.length) {
        setRows((cur) =>
          cur.map((r) => {
            const d: any = (data as any[]).find((x) => x.tag === r.tag);
            return d ? { ...r, titel: d.titel ?? "", text: d.text ?? "", typ: d.typ ?? "", wert: d.wert != null ? String(d.wert) : "" } : r;
          }),
        );
      }
    })();
  }, []);

  const set = (tag: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.tag === tag ? { ...r, ...patch } : r)));

  const save = async () => {
    setSaving(true);
    try {
      const filled = rows.filter((r) => r.titel.trim());
      const empties = rows.filter((r) => !r.titel.trim()).map((r) => r.tag);
      for (const r of filled) {
        const hasCode = r.typ !== "";
        const code = hasCode ? codeFor(r.tag) : null;
        if (hasCode) {
          const { error } = await supabase.from("gutscheine").upsert(
            {
              code: code!,
              typ: r.typ,
              wert: r.typ === "gratis_versand" ? 0 : Number(r.wert) || 0,
              mindestbestellwert: 0,
              max_verwendungen: null,
              gueltig_ab: `${jahr}-12-${String(r.tag).padStart(2, "0")}`,
              gueltig_bis: `${jahr}-12-31`,
              aktiv: true,
              grund: "Adventskalender",
            } as any,
            { onConflict: "code" },
          );
          if (error) throw error;
        }
        const { error } = await supabase.from("advent_tuerchen" as any).upsert(
          { jahr, tag: r.tag, titel: r.titel.trim(), text: r.text.trim() || null, code, typ: r.typ || null, wert: r.typ ? Number(r.wert) || 0 : null } as any,
          { onConflict: "jahr,tag" },
        );
        if (error) throw error;
      }
      if (empties.length) await supabase.from("advent_tuerchen" as any).delete().eq("jahr", jahr).in("tag", empties);
      toast({ title: "Adventskalender gespeichert", description: `${filled.length} Türchen aktiv.` });
    } catch (e: any) {
      toast({ title: "Fehler beim Speichern", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Türchen {jahr}. Mit Rabatt wird automatisch der Code <code>{codeFor(1).replace("-01", "-TT")}</code> angelegt, gültig ab dem jeweiligen Tag bis 31.12.
        Leerer Titel = Türchen bleibt leer. Testen: als Admin eingeloggt erscheint unter dem Kalender auf der Startseite eine Auswahl „Heute ist: …“.
        Der Kalender erscheint nur bei eingeschaltetem Weihnachtsmodus.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => setRows(suggestion())}>
          <Wand2 className="h-4 w-4" /> Vorschlag einfügen
        </Button>
        <Button type="button" size="sm" className="gap-2" onClick={save} disabled={saving}>
          <Save className="h-4 w-4" /> {saving ? "Speichern…" : "Kalender speichern"}
        </Button>
      </div>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.tag} className="grid grid-cols-1 gap-2 rounded-md border border-border p-2 md:grid-cols-[2.5rem_1fr_1.4fr_10rem_5rem] md:items-start">
            <div className="text-sm font-bold md:pt-2">{r.tag}</div>
            <Input value={r.titel} onChange={(e) => set(r.tag, { titel: e.target.value })} placeholder="Titel" className="bg-input border-border" />
            <Textarea value={r.text} onChange={(e) => set(r.tag, { text: e.target.value })} placeholder="Text" rows={1} className="bg-input border-border min-h-9" />
            <select
              value={r.typ}
              onChange={(e) => set(r.tag, { typ: e.target.value })}
              className="h-9 rounded-md border border-border bg-input px-2 text-sm"
            >
              {TYPEN.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
            <Input
              value={r.wert}
              onChange={(e) => set(r.tag, { wert: e.target.value })}
              placeholder={r.typ === "prozent" ? "%" : r.typ === "betrag" ? "CHF" : "–"}
              disabled={r.typ === "" || r.typ === "gratis_versand"}
              inputMode="decimal"
              className="bg-input border-border"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
