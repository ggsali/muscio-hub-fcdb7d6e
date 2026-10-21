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

/** Vorschlag: Mix aus Rabatten (steigend), Gratis-Versand-Tagen und nützlichen Druck-Tipps. */
const PLAN: Record<number, [string, string, string, string]> = {
  1: ["Los geht's: 5 % Rabatt", "Zum Start ein kleines Dankeschön auf deinen nächsten 3D-Druck.", "prozent", "5"],
  2: ["Tipp: PLA oder PETG?", "PLA ist günstig und einfach zu drucken, PETG ist zäher und hält mehr aus. Im Kalkulator siehst du beide Preise sofort.", "", ""],
  3: ["CHF 5 Rabatt", "Ab CHF 20 Bestellwert.", "betrag", "5"],
  4: ["Tipp: Schichthöhe", "Feinere Schichten sehen glatter aus, brauchen aber mehr Zeit. Für Gehäuse und Halter reicht meist die Standardqualität.", "", ""],
  5: ["Gratis Versand", "Heute ohne Versandkosten bestellen.", "gratis_versand", "0"],
  6: ["Nikolaus-Special: 10 %", "Der Nikolaus bringt 10 % auf deine Bestellung.", "prozent", "10"],
  7: ["Tipp: Füllung sparen", "Oft reichen 15 bis 20 % Füllung. Weniger Material bedeutet einen günstigeren Preis.", "", ""],
  8: ["CHF 10 Rabatt", "Ab CHF 40 Bestellwert.", "betrag", "10"],
  9: ["5 % Rabatt", "Ein kleines Extra für heute.", "prozent", "5"],
  10: ["Tipp: Alles zusammen bestellen", "Die Rüstkosten fallen pro Auftrag nur einmal an. Mehrere Teile in einer Bestellung sparen Geld.", "", ""],
  11: ["Gratis Versand", "Heute ohne Versandkosten bestellen.", "gratis_versand", "0"],
  12: ["10 % Rabatt", "Zwölf Türchen geschafft, 10 % für dich.", "prozent", "10"],
  13: ["Tipp: Geschenk mit Namen", "Mit einem eigenen Namen oder einer Widmung im Modell wird aus einem Teil ein persönliches Geschenk.", "", ""],
  14: ["CHF 5 Rabatt", "Ab CHF 20 Bestellwert.", "betrag", "5"],
  15: ["Halbzeit: 15 % Rabatt", "Die Hälfte ist geschafft. Heute gibt es 15 % auf deine Bestellung.", "prozent", "15"],
  16: ["Tipp: Farbe passend wählen", "Farbe und Material bestimmst du direkt im Kalkulator. Schwarz und Weiss sind meist am schnellsten lieferbar.", "", ""],
  17: ["CHF 10 Rabatt", "Ab CHF 40 Bestellwert.", "betrag", "10"],
  18: ["Gratis Versand", "Heute ohne Versandkosten bestellen.", "gratis_versand", "0"],
  19: ["10 % Rabatt", "Noch fünf Tage bis Heiligabend.", "prozent", "10"],
  20: ["Tipp: Jetzt rechtzeitig bestellen", "Je früher du bestellst, desto sicherer ist das Geschenk vor Weihnachten da. Bei Fragen zur Lieferzeit schreib uns kurz.", "", ""],
  21: ["CHF 15 Rabatt", "Ab CHF 60 Bestellwert.", "betrag", "15"],
  22: ["12 % Rabatt", "Kurz vor dem Fest noch ein Geschenk drucken lassen.", "prozent", "12"],
  23: ["Gratis Versand", "Heute ohne Versandkosten bestellen.", "gratis_versand", "0"],
  24: ["Frohe Weihnachten: 20 %", "Zum Abschluss unser grösster Rabatt. Danke für dein Vertrauen.", "prozent", "20"],
};
const suggestion = (): Row[] =>
  empty().map((r) => {
    const [titel, text, typ, wert] = PLAN[r.tag];
    return { ...r, titel, text, typ, wert };
  });

/** Mindestbestellwert für Betrags-Rabatte: ca. das Vierfache des Rabatts. */
const minOrder = (r: Row) => (r.typ === "betrag" ? Math.round((Number(r.wert) || 0) * 4) : 0);

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
              mindestbestellwert: minOrder(r),
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
        Türchen {jahr}. Die Codes gelten im Online-Kalkulator und im Shop. Mit Rabatt wird automatisch der Code <code>{codeFor(1).replace("-01", "-TT")}</code> angelegt, gültig ab dem jeweiligen Tag bis 31.12. Bei Betrags-Rabatten gilt automatisch ein Mindestbestellwert von ca. dem Vierfachen.
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
