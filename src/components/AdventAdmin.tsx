import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Save, Wand2, Users } from "lucide-react";

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
  7: ["Tipp: Bis 15. Dezember bestellen", "Damit dein Geschenk bis Weihnachten ankommt, bestelle bis Mitte Dezember (15. Dezember).", "", ""],
  8: ["CHF 10 Rabatt", "Ab CHF 40 Bestellwert.", "betrag", "10"],
  9: ["5 % Rabatt", "Ein kleines Extra für heute.", "prozent", "5"],
  10: ["Tipp: Alles zusammen bestellen", "Die Rüstkosten fallen pro Auftrag nur einmal an. Mehrere Teile in einer Bestellung sparen Geld.", "", ""],
  11: ["Gratis Versand", "Heute ohne Versandkosten bestellen.", "gratis_versand", "0"],
  12: ["10 % Rabatt", "Zwölf Türchen geschafft, 10 % für dich.", "prozent", "10"],
  13: ["Tipp: Füllung sparen", "Oft reichen 15 bis 20 % Füllung. Weniger Material bedeutet einen günstigeren Preis.", "", ""],
  14: ["CHF 5 Rabatt", "Ab CHF 20 Bestellwert.", "betrag", "5"],
  15: ["Halbzeit: 15 % Rabatt", "Die Hälfte ist geschafft. Heute gibt es 15 % auf deine Bestellung.", "prozent", "15"],
  16: ["Tipp: Geschenk mit Namen", "Mit einem eigenen Namen oder einer Widmung im Modell wird aus einem Teil ein persönliches Geschenk. Bestellungen ab heute kommen erst nach Weihnachten.", "", ""],
  17: ["CHF 10 Rabatt", "Ab CHF 40 Bestellwert. Bestellungen ab jetzt werden erst nach Weihnachten geliefert.", "betrag", "10"],
  18: ["Gratis Versand", "Heute ohne Versandkosten bestellen. Bestellungen ab jetzt werden erst nach Weihnachten geliefert.", "gratis_versand", "0"],
  19: ["10 % Rabatt", "Noch fünf Tage bis Heiligabend. Bestellungen ab jetzt werden erst nach Weihnachten geliefert.", "prozent", "10"],
  20: ["Last Minute: Geschenkgutschein", "Der 3D-Druck-Gutschein kommt sofort per E-Mail und passt immer. Zu finden unter „Gutschein kaufen“.", "", ""],
  21: ["CHF 15 Rabatt", "Ab CHF 60 Bestellwert. Bestellungen ab jetzt werden erst nach Weihnachten geliefert.", "betrag", "15"],
  22: ["12 % Rabatt", "Kurz vor dem Fest noch ein Geschenk drucken lassen. Bestellungen ab jetzt werden erst nach Weihnachten geliefert.", "prozent", "12"],
  23: ["Gratis Versand", "Heute ohne Versandkosten bestellen. Bestellungen ab jetzt werden erst nach Weihnachten geliefert.", "gratis_versand", "0"],
  24: ["Frohe Weihnachten: 20 %", "Zum Abschluss unser grösster Rabatt. Danke für dein Vertrauen. Bestellungen ab jetzt werden erst nach Weihnachten geliefert.", "prozent", "20"],
};
const suggestion = (): Row[] =>
  empty().map((r) => {
    const [titel, text, typ, wert] = PLAN[r.tag];
    return { ...r, titel, text, typ, wert };
  });

/** Mindestbestellwert für Betrags-Rabatte: ca. das Vierfache des Rabatts. */
const minOrder = (r: Row) => (r.typ === "betrag" ? Math.round((Number(r.wert) || 0) * 4) : 0);

type Kunde = { id: string; vorname: string | null; name: string | null; email: string | null; newsletter_aktiv: boolean | null; advent_mail_aktiv: boolean | null };

/** Empfängerliste: einzelne Kunden von der täglichen Türchen-Mail ausschliessen. */
function EmpfaengerAuswahl() {
  const { toast } = useToast();
  const [offen, setOffen] = useState(false);
  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [suche, setSuche] = useState("");
  const [laden, setLaden] = useState(false);

  useEffect(() => {
    if (!offen || kunden.length) return;
    setLaden(true);
    (async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id,vorname,name,email,newsletter_aktiv,advent_mail_aktiv" as any)
        .not("email", "is", null)
        .order("name");
      setLaden(false);
      if (error) { toast({ title: "Kunden konnten nicht geladen werden", description: error.message, variant: "destructive" }); return; }
      setKunden(((data as unknown) as Kunde[]) ?? []);
    })();
  }, [offen]);

  const set = async (ids: string[], aktiv: boolean) => {
    setKunden((ks) => ks.map((k) => (ids.includes(k.id) ? { ...k, advent_mail_aktiv: aktiv } : k)));
    const { error } = await supabase.from("customers").update({ advent_mail_aktiv: aktiv } as any).in("id", ids);
    if (error) toast({ title: "Speichern fehlgeschlagen", description: error.message, variant: "destructive" });
  };

  const q = suche.trim().toLowerCase();
  const gefiltert = kunden.filter((k) => !q || `${k.vorname ?? ""} ${k.name ?? ""} ${k.email ?? ""}`.toLowerCase().includes(q));
  const empfaenger = kunden.filter((k) => k.newsletter_aktiv !== false && k.advent_mail_aktiv !== false).length;
  const ausgeschlossen = kunden.filter((k) => k.newsletter_aktiv !== false && k.advent_mail_aktiv === false).length;
  const filterIds = gefiltert.filter((k) => k.newsletter_aktiv !== false).map((k) => k.id);

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <button type="button" onClick={() => setOffen((o) => !o)} className="flex w-full items-center gap-2 text-left text-sm font-medium">
        <Users className="h-4 w-4" /> Empfänger der Türchen-Mail {offen ? "▾" : "▸"}
        {kunden.length > 0 && <span className="ml-auto text-xs font-normal text-muted-foreground">{empfaenger} Empfänger, {ausgeschlossen} ausgeschlossen</span>}
      </button>
      {offen && (
        <>
          <p className="text-xs text-muted-foreground">
            Haken = bekommt die tägliche Türchen-Mail. Ohne Haken wird der Kunde ausgeschlossen (nur für den Adventskalender, sein Newsletter bleibt unberührt).
            Kunden, die den Newsletter abgemeldet haben, bekommen sowieso nichts.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Input value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="Suchen (Name oder E-Mail)" className="w-64 bg-input border-border" />
            <Button type="button" size="sm" variant="outline" onClick={() => set(filterIds, true)}>Gefilterte alle an</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => set(filterIds, false)}>Gefilterte alle aus</Button>
          </div>
          {laden && <p className="text-xs text-muted-foreground">Laden…</p>}
          <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
            {gefiltert.map((k) => {
              const nlAus = k.newsletter_aktiv === false;
              const an = !nlAus && k.advent_mail_aktiv !== false;
              return (
                <label key={k.id} className={`flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted/50 ${nlAus ? "opacity-50" : "cursor-pointer"}`}>
                  <input type="checkbox" checked={an} disabled={nlAus} onChange={(e) => set([k.id], e.target.checked)} />
                  <span className="truncate">{[k.vorname, k.name].filter(Boolean).join(" ") || "–"}</span>
                  <span className="truncate text-xs text-muted-foreground">{k.email}</span>
                  {nlAus && <span className="ml-auto shrink-0 text-xs">Newsletter aus</span>}
                </label>
              );
            })}
            {!laden && gefiltert.length === 0 && <p className="text-xs text-muted-foreground">Keine Kunden gefunden.</p>}
          </div>
        </>
      )}
    </div>
  );
}

export function AdventAdmin() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>(empty());
  const [saving, setSaving] = useState(false);
  const [mailTag, setMailTag] = useState<string>("");
  const [testEmail, setTestEmail] = useState("");
  const [mailBusy, setMailBusy] = useState(false);

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
              gueltig_bis: `${jahr}-12-${String(r.tag).padStart(2, "0")}`,
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

  const sendDaily = async (alle: boolean) => {
    const tag = Number(mailTag);
    if (!alle && !testEmail.trim()) { toast({ title: "Bitte Test-E-Mail eingeben", variant: "destructive" }); return; }
    if (alle && !window.confirm(`Türchen-Mail wirklich an ALLE Kunden mit aktivem Newsletter senden?`)) return;
    setMailBusy(true);
    const { data, error } = await supabase.functions.invoke("advent-mail", {
      body: { action: "daily", tag: tag >= 1 && tag <= 24 ? tag : undefined, test_email: alle ? undefined : testEmail.trim() },
    });
    setMailBusy(false);
    if (error || data?.error) { toast({ title: "Versand fehlgeschlagen", description: data?.error || error?.message, variant: "destructive" }); return; }
    toast({ title: data?.skipped ? "Nichts gesendet" : "Gesendet", description: data?.skipped ?? `${data?.sent ?? 0} E-Mails gesendet${data?.remaining ? `, ${data.remaining} offen (erneut senden)` : ""}.` });
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Türchen {jahr}. Die Codes gelten im Online-Kalkulator und im Shop. Mit Rabatt wird automatisch der Code <code>{codeFor(1).replace("-01", "-TT")}</code> angelegt, gültig NUR am jeweiligen Tag (Schweizer Zeit). Bei Betrags-Rabatten gilt automatisch ein Mindestbestellwert von ca. dem Vierfachen.
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
      <div className="space-y-2 rounded-md border border-border p-3">
        <p className="text-sm font-medium">Tägliche Türchen-Mail</p>
        <p className="text-xs text-muted-foreground">
          Geht jeden Tag automatisch an alle Kunden mit aktivem Newsletter (mit Abmelde-Link), sobald der tägliche Versand eingerichtet ist.
          Hier kannst du ihn testen oder von Hand auslösen. Pro Kunde und Türchen wird nur einmal gesendet.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Input value={mailTag} onChange={(e) => setMailTag(e.target.value)} placeholder="Türchen (1–24, leer = heute)" className="w-48 bg-input border-border" inputMode="numeric" />
          <Input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="Test-E-Mail" className="w-56 bg-input border-border" />
          <Button type="button" size="sm" variant="outline" disabled={mailBusy} onClick={() => sendDaily(false)}>Testmail senden</Button>
          <Button type="button" size="sm" disabled={mailBusy} onClick={() => sendDaily(true)}>An alle senden</Button>
        </div>
      </div>
      <EmpfaengerAuswahl />
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
