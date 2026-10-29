import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "@/lib/router-compat";
import { formatCHF } from "@/lib/calc";
import { StatusBadge } from "@/components/StatusBadge";
import {
  ladeUmsatzAuftraege, monatsSummen, monatLabel, monatKey, monatVerschieben, aktuellerMonat,
  aenderung, type UmsatzAuftrag,
} from "@/lib/umsatz";
import { ArrowLeft, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
} from "recharts";

const PRIMARY = "hsl(var(--primary))";
const MUTED = "hsl(var(--muted-foreground))";

function Delta({ wert }: { wert: number | null }) {
  if (wert === null) return <span className="text-xs text-muted-foreground">kein Vergleich</span>;
  const pos = wert > 0.05, neg = wert < -0.05;
  const Icon = pos ? TrendingUp : neg ? TrendingDown : Minus;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${pos ? "text-success" : neg ? "text-destructive" : "text-muted-foreground"}`}>
      <Icon className="w-3 h-3" />{wert > 0 ? "+" : ""}{wert.toFixed(1)} %
    </span>
  );
}

export default function UmsatzAnalysePage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [auftraege, setAuftraege] = useState<UmsatzAuftrag[]>([]);
  const [loading, setLoading] = useState(true);
  const jetzt = aktuellerMonat();
  const gewaehlt = /^\d{4}-\d{2}$/.test(params.get("monat") ?? "") ? params.get("monat")! : jetzt;

  useEffect(() => {
    ladeUmsatzAuftraege().then((a) => { setAuftraege(a); setLoading(false); });
  }, []);

  const waehle = (k: string) => setParams({ monat: k }, { replace: true });

  // 24 Monate lückenlos: die letzten 12 und die 12 davor als Vorjahresvergleich
  const reihe = useMemo(() => monatsSummen(auftraege, monatVerschieben(jetzt, -23), jetzt), [auftraege, jetzt]);
  const nachKey = useMemo(() => new Map(reihe.map((m) => [m.key, m])), [reihe]);
  const letzte12 = reihe.slice(12);
  const chartDaten = letzte12.map((m) => ({
    key: m.key,
    monat: monatLabel(m.key),
    umsatz: m.umsatz,
    gewinn: m.gewinn,
    vorjahr: nachKey.get(monatVerschieben(m.key, -12))?.umsatz ?? 0,
  }));

  const aktuell = nachKey.get(gewaehlt) ?? { key: gewaehlt, umsatz: 0, gewinn: 0, anzahl: 0 };
  const vormonat = nachKey.get(monatVerschieben(gewaehlt, -1));
  const vorjahr = nachKey.get(monatVerschieben(gewaehlt, -12));
  const schnitt12 = letzte12.reduce((s, m) => s + m.umsatz, 0) / 12;

  // Kumuliert seit Jahresbeginn bis zum gewählten Monat, gegen Vorjahr
  const jahr = gewaehlt.slice(0, 4);
  const ytd = (j: string, bisMonat: string) =>
    auftraege.filter((a) => a.zahlDatum.slice(0, 4) === j && a.zahlDatum.slice(5, 7) <= bisMonat).reduce((s, a) => s + a.umsatz, 0);
  const ytdAktuell = ytd(jahr, gewaehlt.slice(5, 7));
  const ytdVorjahr = ytd(String(Number(jahr) - 1), gewaehlt.slice(5, 7));

  const imMonat = useMemo(
    () => auftraege.filter((a) => monatKey(a.zahlDatum) === gewaehlt).sort((a, b) => b.zahlDatum.localeCompare(a.zahlDatum)),
    [auftraege, gewaehlt]
  );
  const topKunden = useMemo(() => {
    const m = new Map<string, number>();
    imMonat.forEach((a) => m.set(a.kunde, (m.get(a.kunde) ?? 0) + a.umsatz));
    return Array.from(m.entries()).map(([name, umsatz]) => ({ name, umsatz })).sort((a, b) => b.umsatz - a.umsatz).slice(0, 5);
  }, [imMonat]);

  const marge = aktuell.umsatz > 0 ? (aktuell.gewinn / aktuell.umsatz) * 100 : 0;
  const schnittAuftrag = aktuell.anzahl ? aktuell.umsatz / aktuell.anzahl : 0;
  const bestKey = letzte12.reduce((b, m) => (m.umsatz > b.umsatz ? m : b), letzte12[0]);

  const kacheln = [
    { label: `Umsatz ${monatLabel(gewaehlt)}`, wert: formatCHF(aktuell.umsatz), sub: <span className="text-xs text-muted-foreground">{aktuell.anzahl} Aufträge</span> },
    { label: "gegenüber Vormonat", wert: formatCHF(vormonat?.umsatz ?? 0), sub: <Delta wert={aenderung(aktuell.umsatz, vormonat?.umsatz ?? 0)} /> },
    { label: "gegenüber Vorjahresmonat", wert: formatCHF(vorjahr?.umsatz ?? 0), sub: <Delta wert={aenderung(aktuell.umsatz, vorjahr?.umsatz ?? 0)} /> },
    { label: "Ø der letzten 12 Monate", wert: formatCHF(schnitt12), sub: <Delta wert={aenderung(aktuell.umsatz, schnitt12)} /> },
    { label: "Gewinn", wert: formatCHF(aktuell.gewinn), sub: <span className="text-xs text-muted-foreground">Marge {marge.toFixed(1)} %</span> },
    { label: `Seit Jahresbeginn ${jahr}`, wert: formatCHF(ytdAktuell), sub: <span className="text-xs"><Delta wert={aenderung(ytdAktuell, ytdVorjahr)} /> <span className="text-muted-foreground">zum Vorjahr ({formatCHF(ytdVorjahr)})</span></span> },
  ];

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Wird geladen…</div>;

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/admin")} className="p-1.5 rounded-md hover:bg-muted" aria-label="Zurück"><ArrowLeft className="w-4 h-4" /></button>
        <div className="flex-1">
          <h1 className="text-xl md:text-2xl font-bold">Umsatz-Analyse</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Bezahlte Aufträge, nach Zahlungsdatum. Klicke einen Monat im Diagramm an.</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => waehle(monatVerschieben(gewaehlt, -1))} className="px-2 py-1 text-sm border border-border rounded-md hover:bg-muted">‹</button>
          <span className="px-2 text-sm font-medium min-w-[110px] text-center">{monatLabel(gewaehlt, "lang")}</span>
          <button onClick={() => waehle(monatVerschieben(gewaehlt, 1))} disabled={gewaehlt >= jetzt} className="px-2 py-1 text-sm border border-border rounded-md hover:bg-muted disabled:opacity-40">›</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4">
        {kacheln.map((k) => (
          <div key={k.label} className="bg-card border border-border rounded-xl p-3 md:p-4">
            <div className="text-[10px] md:text-xs text-muted-foreground">{k.label}</div>
            <div className="text-lg md:text-2xl font-bold leading-tight mt-1">{k.wert}</div>
            <div className="mt-0.5">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-lg p-4 md:p-5">
        <h2 className="font-semibold text-sm mb-3">Verlauf der letzten 12 Monate (mit Vorjahr)</h2>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={chartDaten} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="monat" tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
              formatter={(v: number, n: string) => [formatCHF(v), n]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="umsatz" name="Umsatz" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(d: any) => d?.key && waehle(d.key)}>
              {chartDaten.map((d) => <Cell key={d.key} fill={d.key === gewaehlt ? PRIMARY : "hsl(var(--primary) / 0.35)"} />)}
            </Bar>
            <Line type="monotone" dataKey="gewinn" name="Gewinn" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="vorjahr" name="Vorjahr (Umsatz)" stroke={MUTED} strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
        {bestKey && bestKey.umsatz > 0 && (
          <p className="text-xs text-muted-foreground mt-2">Bester Monat: {monatLabel(bestKey.key, "lang")} mit {formatCHF(bestKey.umsatz)}.</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border"><h2 className="font-semibold text-sm">Monatsvergleich</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Monat</th>
                  <th className="text-right px-4 py-2 font-medium">Umsatz</th>
                  <th className="text-right px-4 py-2 font-medium">Gewinn</th>
                  <th className="text-right px-4 py-2 font-medium">Aufträge</th>
                  <th className="text-right px-4 py-2 font-medium">zum Vormonat</th>
                </tr>
              </thead>
              <tbody>
                {[...letzte12].reverse().map((m) => {
                  const vm = nachKey.get(monatVerschieben(m.key, -1));
                  return (
                    <tr key={m.key} onClick={() => waehle(m.key)} className={`border-t border-border cursor-pointer hover:bg-muted/30 ${m.key === gewaehlt ? "bg-primary/10" : ""}`}>
                      <td className="px-4 py-2">{monatLabel(m.key, "lang")}</td>
                      <td className="px-4 py-2 text-right font-medium">{formatCHF(m.umsatz)}</td>
                      <td className="px-4 py-2 text-right">{formatCHF(m.gewinn)}</td>
                      <td className="px-4 py-2 text-right">{m.anzahl}</td>
                      <td className="px-4 py-2 text-right"><Delta wert={aenderung(m.umsatz, vm?.umsatz ?? 0)} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold text-sm">Aufträge {monatLabel(gewaehlt, "lang")}</h2>
              <span className="text-xs text-muted-foreground">Ø {formatCHF(schnittAuftrag)}</span>
            </div>
            {imMonat.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">Keine bezahlten Aufträge in diesem Monat.</p>
            ) : (
              <div className="divide-y divide-border max-h-80 overflow-y-auto">
                {imMonat.map((a) => (
                  <div key={a.id} onClick={() => navigate(`/admin/auftraege/${a.id}`)} className="px-4 py-2.5 cursor-pointer hover:bg-muted/30 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{a.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {a.kunde} · {new Date(a.zahlDatum).toLocaleDateString("de-CH")}{a.zahlDatumQuelle === "auftrag" ? " (Auftragsdatum)" : ""}
                      </div>
                    </div>
                    <StatusBadge status={a.status} />
                    <span className="text-sm font-bold shrink-0">{formatCHF(a.umsatz)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {topKunden.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-4">
              <h2 className="font-semibold text-sm mb-2">Top-Kunden im Monat</h2>
              <div className="space-y-1.5">
                {topKunden.map((k) => (
                  <div key={k.name} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 truncate">{k.name}</span>
                    <span className="text-xs text-muted-foreground">{aktuell.umsatz ? ((k.umsatz / aktuell.umsatz) * 100).toFixed(0) : 0} %</span>
                    <span className="font-medium">{formatCHF(k.umsatz)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
