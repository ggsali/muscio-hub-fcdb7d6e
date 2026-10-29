import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { formatCHF } from "@/lib/calc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Wand2 } from "lucide-react";
import {
  ladeUmsatzAuftraege, monatsSummen, monatLabel, monatVerschieben, aktuellerMonat, type UmsatzAuftrag,
} from "@/lib/umsatz";
import {
  ladeFixkosten, fixkostenImMonat, fixkostenSumme, FIXKOSTEN_KATEGORIEN, FIXKOSTEN_VORSCHLAEGE, type Fixkosten,
} from "@/lib/fixkosten";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";

/** Kategorien der Ausgaben-Liste (Finanzen), die hier NICHT zählen: Material steckt in den Auftragskosten, Abos/Maschinen in den Fixkosten */
const AUSGABEN_AUSGENOMMEN = ["Filament", "Maschinen", "Software/Abos"];

interface Ausgabe { id: string; datum: string; kategorie: string; beschreibung: string; betrag: number }

const MUTED = "hsl(var(--muted-foreground))";

export default function RentabilitaetPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const jetzt = aktuellerMonat();
  const gewaehlt = /^\d{4}-\d{2}$/.test(params.get("monat") ?? "") ? params.get("monat")! : jetzt;

  const [auftraege, setAuftraege] = useState<UmsatzAuftrag[]>([]);
  const [fixkosten, setFixkosten] = useState<Fixkosten[]>([]);
  const [ausgaben, setAusgaben] = useState<Ausgabe[]>([]);
  const [loading, setLoading] = useState(true);
  const [neu, setNeu] = useState({ name: "", betrag: "", intervall: "monatlich", kategorie: "Software/Abos", gueltig_ab: "", gueltig_bis: "" });

  const laden = async () => {
    const [a, f, ex] = await Promise.all([
      ladeUmsatzAuftraege(),
      ladeFixkosten().catch(() => [] as Fixkosten[]),
      (supabase.from as any)("ausgaben").select("id, datum, kategorie, beschreibung, betrag"),
    ]);
    setAuftraege(a);
    setFixkosten(f);
    setAusgaben(((ex.data ?? []) as any[]).map((x) => ({ ...x, betrag: Number(x.betrag) || 0 })));
    setLoading(false);
  };
  useEffect(() => { laden(); }, []);

  const waehle = (k: string) => setParams({ monat: k }, { replace: true });

  const ausgabenImMonat = (k: string) =>
    ausgaben.filter((x) => x.datum.slice(0, 7) === k && !AUSGABEN_AUSGENOMMEN.includes(x.kategorie)).reduce((s, x) => s + x.betrag, 0);

  const reihe = useMemo(() => {
    const summen = monatsSummen(auftraege, monatVerschieben(jetzt, -11), jetzt);
    return summen.map((m) => {
      const fix = fixkostenSumme(fixkosten, m.key);
      const aus = ausgabenImMonat(m.key);
      const variabel = m.umsatz - m.gewinn;
      return {
        key: m.key, monat: monatLabel(m.key), umsatz: m.umsatz, anzahl: m.anzahl,
        variabel: Math.round(variabel * 100) / 100,
        db: m.gewinn, fix: Math.round(fix * 100) / 100, aus: Math.round(aus * 100) / 100,
        kosten: Math.round((variabel + fix + aus) * 100) / 100,
        ergebnis: Math.round((m.gewinn - fix - aus) * 100) / 100,
      };
    });
  }, [auftraege, fixkosten, ausgaben, jetzt]);

  const aktuell = reihe.find((r) => r.key === gewaehlt) ?? { key: gewaehlt, monat: monatLabel(gewaehlt), umsatz: 0, anzahl: 0, variabel: 0, db: 0, fix: fixkostenSumme(fixkosten, gewaehlt), aus: ausgabenImMonat(gewaehlt), kosten: 0, ergebnis: 0 };
  const fixGesamt = aktuell.fix + aktuell.aus;
  const dbQuote = aktuell.umsatz > 0 ? aktuell.db / aktuell.umsatz : (() => {
    const mit = reihe.filter((r) => r.umsatz > 0);
    const u = mit.reduce((s, r) => s + r.umsatz, 0);
    return u > 0 ? mit.reduce((s, r) => s + r.db, 0) / u : 0.6;
  })();
  const breakEvenUmsatz = dbQuote > 0 ? fixGesamt / dbQuote : 0;
  const deckung = fixGesamt > 0 ? Math.min(100, (aktuell.db / fixGesamt) * 100) : 100;
  const gedeckt = aktuell.db >= fixGesamt;
  const jahresErgebnis = reihe.reduce((s, r) => s + r.ergebnis, 0);
  const schnittErgebnis = reihe.length ? jahresErgebnis / reihe.length : 0;

  const speichern = async () => {
    const betrag = parseFloat(neu.betrag.replace(",", "."));
    if (!neu.name.trim() || Number.isNaN(betrag)) { toast.error("Bitte Name und Betrag angeben"); return; }
    const { error } = await (supabase.from as any)("fixkosten").insert({
      name: neu.name.trim(), betrag, intervall: neu.intervall, kategorie: neu.kategorie,
      gueltig_ab: neu.gueltig_ab || null, gueltig_bis: neu.gueltig_bis || null,
    });
    if (error) { toast.error("Speichern fehlgeschlagen: " + error.message); return; }
    setNeu({ name: "", betrag: "", intervall: "monatlich", kategorie: "Software/Abos", gueltig_ab: "", gueltig_bis: "" });
    laden();
  };
  const loeschen = async (id: string) => {
    const { error } = await (supabase.from as any)("fixkosten").delete().eq("id", id);
    if (error) { toast.error("Löschen fehlgeschlagen: " + error.message); return; }
    laden();
  };
  const vorschlaege = async () => {
    const { error } = await (supabase.from as any)("fixkosten").insert(FIXKOSTEN_VORSCHLAEGE);
    if (error) { toast.error("Vorschläge konnten nicht angelegt werden: " + error.message); return; }
    toast.success("Vorschläge eingefügt – bitte Beträge prüfen");
    laden();
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Wird geladen…</div>;

  const kacheln = [
    { label: "Umsatz (bezahlt)", wert: formatCHF(aktuell.umsatz), sub: `${aktuell.anzahl} Aufträge` },
    { label: "Auftragskosten (Material, Strom, Verschleiss)", wert: formatCHF(aktuell.variabel), sub: "variable Kosten" },
    { label: "Deckungsbeitrag", wert: formatCHF(aktuell.db), sub: `${(dbQuote * 100).toFixed(0)} % vom Umsatz` },
    { label: "Fixkosten + Ausgaben", wert: formatCHF(fixGesamt), sub: `Fixkosten ${formatCHF(aktuell.fix)} · Ausgaben ${formatCHF(aktuell.aus)}` },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/admin")} className="p-1.5 rounded-md hover:bg-muted" aria-label="Zurück"><ArrowLeft className="w-4 h-4" /></button>
        <div className="flex-1">
          <h1 className="text-xl md:text-2xl font-bold">Rentabilität</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Tragen deine Aufträge die Kosten? Ergebnis vor Eigenlohn, pro Monat.</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => waehle(monatVerschieben(gewaehlt, -1))} className="px-2 py-1 text-sm border border-border rounded-md hover:bg-muted">‹</button>
          <span className="px-2 text-sm font-medium min-w-[110px] text-center">{monatLabel(gewaehlt, "lang")}</span>
          <button onClick={() => waehle(monatVerschieben(gewaehlt, 1))} disabled={gewaehlt >= jetzt} className="px-2 py-1 text-sm border border-border rounded-md hover:bg-muted disabled:opacity-40">›</button>
        </div>
      </div>

      <div className={`rounded-xl border p-4 md:p-5 ${aktuell.ergebnis >= 0 ? "border-success/40 bg-success/5" : "border-destructive/40 bg-destructive/5"}`}>
        <div className="text-xs text-muted-foreground">Ergebnis {monatLabel(gewaehlt, "lang")} (vor Eigenlohn)</div>
        <div className={`text-2xl md:text-3xl font-bold mt-1 ${aktuell.ergebnis >= 0 ? "text-success" : "text-destructive"}`}>{aktuell.ergebnis >= 0 ? "+" : ""}{formatCHF(aktuell.ergebnis)}</div>
        <div className="mt-3">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Fixkosten gedeckt: {deckung.toFixed(0)} %</span>
            <span>{gedeckt ? "Gewinnschwelle erreicht" : `noch ${formatCHF(fixGesamt - aktuell.db)} Deckungsbeitrag`}</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2.5"><div className={`h-2.5 rounded-full ${gedeckt ? "bg-success" : "bg-warning"}`} style={{ width: `${deckung}%` }} /></div>
          {fixGesamt > 0 && (
            <p className="text-xs text-muted-foreground mt-2">Gewinnschwelle: ca. {formatCHF(breakEvenUmsatz)} Umsatz im Monat (bei {(dbQuote * 100).toFixed(0)} % Deckungsbeitrag).</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
        {kacheln.map((k) => (
          <div key={k.label} className="bg-card border border-border rounded-xl p-3 md:p-4">
            <div className="text-[10px] md:text-xs text-muted-foreground">{k.label}</div>
            <div className="text-lg md:text-xl font-bold leading-tight mt-1">{k.wert}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-lg p-4 md:p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm">Umsatz, Kosten und Ergebnis (12 Monate)</h2>
          <span className="text-xs text-muted-foreground">Ø Ergebnis {formatCHF(schnittErgebnis)} / Monat</span>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={reihe} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="monat" tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }} formatter={(v: number, n: string) => [formatCHF(v), n]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine y={0} stroke={MUTED} />
            <Bar dataKey="umsatz" name="Umsatz" fill="hsl(var(--primary) / 0.45)" radius={[4, 4, 0, 0]} />
            <Line type="monotone" dataKey="kosten" name="Gesamtkosten" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="ergebnis" name="Ergebnis" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
          <h2 className="font-semibold text-sm">Fixkosten</h2>
          {fixkosten.length === 0 && (
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={vorschlaege}><Wand2 className="w-3.5 h-3.5" />Vorschläge einfügen</Button>
          )}
        </div>
        {fixkosten.length === 0 ? (
          <p className="px-4 py-5 text-sm text-muted-foreground">Noch keine Fixkosten erfasst. Mit «Vorschläge einfügen» legst du Drucker-Abschreibung, Lovable, SimplyPrint und IONOS an (ungefähre CHF-Beträge, bitte prüfen) oder erfasst unten eigene Positionen.</p>
        ) : (
          <div className="divide-y divide-border">
            {fixkosten.map((f) => (
              <div key={f.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{f.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {f.kategorie} · {f.intervall === "jaehrlich" ? "jährlich" : "monatlich"}
                    {f.gueltig_ab ? ` · ab ${new Date(f.gueltig_ab).toLocaleDateString("de-CH")}` : ""}
                    {f.gueltig_bis ? ` · bis ${new Date(f.gueltig_bis).toLocaleDateString("de-CH")}` : ""}
                    {f.notiz ? ` · ${f.notiz}` : ""}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold">{formatCHF(f.betrag)}</div>
                  <div className="text-[10px] text-muted-foreground">{fixkostenImMonat(f, gewaehlt) > 0 ? `im ${monatLabel(gewaehlt)}: ${formatCHF(fixkostenImMonat(f, gewaehlt))}` : "in diesem Monat nicht aktiv"}</div>
                </div>
                <button onClick={() => loeschen(f.id)} className="p-1.5 text-muted-foreground hover:text-destructive" aria-label="Löschen"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        )}
        <div className="px-4 py-3 border-t border-border bg-muted/20 grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
          <Input placeholder="Name (z. B. Versicherung)" value={neu.name} onChange={(e) => setNeu({ ...neu, name: e.target.value })} className="col-span-2 h-9 text-sm" />
          <Input placeholder="Betrag CHF" inputMode="decimal" value={neu.betrag} onChange={(e) => setNeu({ ...neu, betrag: e.target.value })} className="h-9 text-sm" />
          <select value={neu.intervall} onChange={(e) => setNeu({ ...neu, intervall: e.target.value })} className="h-9 px-2 rounded bg-input border border-border text-sm">
            <option value="monatlich">monatlich</option>
            <option value="jaehrlich">jährlich</option>
          </select>
          <select value={neu.kategorie} onChange={(e) => setNeu({ ...neu, kategorie: e.target.value })} className="h-9 px-2 rounded bg-input border border-border text-sm">
            {FIXKOSTEN_KATEGORIEN.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <Button size="sm" className="gap-1.5 h-9" onClick={speichern}><Plus className="w-3.5 h-3.5" />Hinzufügen</Button>
        </div>
        <p className="px-4 py-2 text-[11px] text-muted-foreground border-t border-border">
          Strom und Verschleiss stecken schon in den Auftragskosten (Einstellung «Strom/Verschleiss pro Stunde»), Filament-Einkäufe ebenfalls. Darum zählen Ausgaben der Kategorien Filament, Maschinen und Software/Abos hier nicht noch einmal. Fehldrucke sind nicht eingerechnet.
        </p>
      </div>
    </div>
  );
}
