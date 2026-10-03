import { Link } from "@/lib/router-compat";
import { useEffect, useState } from "react";
import { ScrollReveal } from "@/components/site/ScrollReveal";
import { Button } from "@/components/ui/button";
import { ArrowRight, Layers, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Seo from "@/components/site/Seo";
import { useResinEnabled, isResinText } from "@/hooks/useResinEnabled";

interface MaterialRow {
  id: string;
  name: string;
  tag: string;
  price_per_gram: number;
  description: string | null;
}

const USES: Record<string, string[]> = {
  PLA: ["Prototypen", "Modelle", "Dekoration"],
  PETG: ["Funktionsteile", "Behälter", "Outdoor"],
  ABS: ["Gehäuse", "Industrie", "Automotive"],
  ASA: ["Outdoor", "Automotive", "UV-Belastung"],
  "ABS/ASA": ["Industrie", "Automotive", "Outdoor"],
  TPU: ["Dichtungen", "Griffe", "Sport"],
  Nylon: ["Zahnräder", "Lager", "Werkzeuge"],
  Resin: ["Schmuck", "Miniaturen", "Dental"],
};

/** Technische Eigenschaften: 1–5 Sterne, für Karten und Vergleichstabelle */
interface MatProps {
  strength: number;
  temp: number;
  uv: number;
  chemical: number;
  tempC: string;
  outdoor: "yes" | "partial" | "no";
  flexible: "yes" | "no";
  impact: "yes" | "partial" | "no";
  food: "yes" | "no";
  tags: string[];
}

const PROPS: Record<string, MatProps> = {
  PLA:      { strength: 3, temp: 1, uv: 1, chemical: 2, tempC: "55 °C",  outdoor: "no",      flexible: "no",  impact: "partial", food: "no",  tags: [] },
  PETG:     { strength: 4, temp: 3, uv: 3, chemical: 4, tempC: "75 °C",  outdoor: "partial", flexible: "no",  impact: "yes",     food: "yes", tags: ["lebensmittel"] },
  ABS:      { strength: 4, temp: 4, uv: 2, chemical: 3, tempC: "95 °C",  outdoor: "no",      flexible: "no",  impact: "yes",     food: "no",  tags: ["hitze"] },
  ASA:      { strength: 4, temp: 4, uv: 5, chemical: 4, tempC: "100 °C", outdoor: "yes",     flexible: "no",  impact: "yes",     food: "no",  tags: ["aussen", "hitze"] },
  "ABS/ASA":{ strength: 4, temp: 4, uv: 4, chemical: 4, tempC: "100 °C", outdoor: "yes",     flexible: "no",  impact: "yes",     food: "no",  tags: ["aussen", "hitze"] },
  TPU:      { strength: 3, temp: 2, uv: 3, chemical: 3, tempC: "70 °C",  outdoor: "partial", flexible: "yes", impact: "yes",     food: "no",  tags: ["flexibel"] },
  Nylon:    { strength: 5, temp: 4, uv: 2, chemical: 4, tempC: "110 °C", outdoor: "no",      flexible: "no",  impact: "yes",     food: "no",  tags: ["hitze"] },
  Resin:    { strength: 2, temp: 2, uv: 1, chemical: 2, tempC: "60 °C",  outdoor: "no",      flexible: "no",  impact: "no",      food: "no",  tags: [] },
};

const FILTERS = [
  { id: "all",          label: "Alle" },
  { id: "aussen",       label: "Aussenbereich" },
  { id: "hitze",        label: "Hitzebeständig" },
  { id: "flexibel",     label: "Flexibel" },
  { id: "lebensmittel", label: "Lebensmittelkontakt" },
];

type DotState = "yes" | "partial" | "no";

const Dot = ({ state, label }: { state: DotState; label: string }) => {
  const colorClass =
    state === "yes"     ? "bg-primary" :
    state === "partial" ? "bg-amber-500" :
                          "bg-border";
  const text =
    state === "yes"     ? "Ja" :
    state === "partial" ? "Bedingt" :
                          "Nein";
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap" aria-label={`${label}: ${text}`}>
      <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${colorClass}`} />
      <span className="text-muted-foreground text-xs">{text}</span>
    </span>
  );
};

const Bar = ({ value, label }: { value: number; label: string }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="flex gap-1" aria-label={`${label}: ${value} von 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={`h-1.5 w-3 rounded-full ${n <= value ? "bg-primary" : "bg-border"}`}
        />
      ))}
    </span>
  </div>
);

const fmtPrice = (v: number) =>
  Number(v).toFixed(3).replace(/0+$/, "").replace(/\.$/, "");

export default function MaterialienPage() {
  const [allMaterials, setMaterials] = useState<MaterialRow[]>([]);
  const resin = useResinEnabled();
  const materials = resin ? allMaterials : allMaterials.filter((m) => !isResinText(m.name) && !isResinText(m.tag));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState("all");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("materials")
        .select("id, name, tag, price_per_gram, description")
        .eq("aktiv", true)
        .order("sort_order");
      if (error) setError("Materialien konnten nicht geladen werden.");
      else if (data) setMaterials(data as MaterialRow[]);
      setLoading(false);
    })();
  }, []);

  const filteredMaterials = materials.filter((m) => {
    if (activeFilter === "all") return true;
    const p = PROPS[m.name];
    return p?.tags.includes(activeFilter) ?? false;
  });

  return (
    <div>
      <Seo
        title="Materialien für 3D Druck – PLA, PETG, ABS, ASA, TPU, Resin | 3DMuscio"
        description="Übersicht aller Materialien für Ihren 3D Druck: PLA, PETG, ABS, ASA, TPU und SLA Resin mit Festigkeit, Temperatur- und UV-Beständigkeit, Einsatzgebieten und Preis pro Gramm."
        path="/materialien"
      />

      <section className="container mx-auto px-4 pt-12 pb-12">
        <ScrollReveal>
          <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">Materialien</p>
          <h1 className="font-heading text-3xl md:text-6xl font-bold tracking-tight mb-4">
            Für jeden Einsatz<br /><span className="text-primary">das richtige Material.</span>
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Alle Materialien mit technischen Eigenschaften, typischen Anwendungen und transparentem
            Preis pro Gramm. Unsicher? Wir beraten Sie kostenlos.
          </p>
        </ScrollReveal>
      </section>

      <section className="container mx-auto px-4 pb-16">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="text-center py-20 text-destructive">{error}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {materials.map((m, i) => {
              const uses = USES[m.name] || [];
              const p = PROPS[m.name];
              return (
                <ScrollReveal key={m.id} delay={i * 0.05}>
                  <div className="bg-card border border-border rounded-3xl p-6 hover:border-primary/40 hover:shadow-[0_12px_30px_-12px_hsl(var(--foreground)/0.12)] transition-all h-full flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Layers className="w-4 h-4 text-primary" />
                        </div>
                        <h2 className="font-heading text-xl font-bold">{m.name}</h2>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-muted tracking-wider">{m.tag}</span>
                    </div>

                    <p className="text-sm text-muted-foreground mb-5">{m.description}</p>

                    {p && (
                      <div className="space-y-2 mb-5">
                        <Bar label="Festigkeit" value={p.strength} />
                        <Bar label="Temperaturbeständig" value={p.temp} />
                        <Bar label="UV-Beständigkeit" value={p.uv} />
                        <Bar label="Chemikalienbeständig" value={p.chemical} />
                      </div>
                    )}

                    {uses.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-5">
                        {uses.map((u) => (
                          <span key={u} className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                            {u}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between border-t border-border pt-3 mt-auto">
                      <span className="text-xs text-muted-foreground">{p?.tempC ?? "ab"}</span>
                      <span className="font-heading font-bold text-primary">
                        CHF {fmtPrice(m.price_per_gram)}/g
                      </span>
                    </div>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        )}
      </section>

      {/* Vergleichstabelle mit Filterung */}
      {!loading && !error && materials.length > 0 && (
        <section className="container mx-auto px-4 pb-16">
          <ScrollReveal>
            <h2 className="font-heading text-2xl md:text-3xl font-bold tracking-tight mb-2">
              Materialien im Vergleich
            </h2>
            <p className="text-muted-foreground text-sm mb-5">
              Filtern Sie nach Einsatzbereich – für die richtige Wahl auf den ersten Blick.
            </p>

            {/* Filter Pills */}
            <div className="flex flex-wrap gap-2 mb-5">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setActiveFilter(f.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    activeFilter === f.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto rounded-2xl border border-border bg-card">
              <table className="w-full text-sm min-w-[680px]">
                <caption className="sr-only">
                  Vergleich der 3D-Druck-Materialien nach Temperatur, Aussenbereich, Flexibilität, Schlagfestigkeit und Lebensmittelkontakt
                </caption>
                <thead>
                  <tr className="bg-muted/50 text-left">
                    <th scope="col" className="p-4 font-heading font-semibold text-xs uppercase tracking-wide text-muted-foreground">Material</th>
                    <th scope="col" className="p-4 font-heading font-semibold text-xs uppercase tracking-wide text-muted-foreground">Max. Temp.</th>
                    <th scope="col" className="p-4 font-heading font-semibold text-xs uppercase tracking-wide text-muted-foreground">Aussen</th>
                    <th scope="col" className="p-4 font-heading font-semibold text-xs uppercase tracking-wide text-muted-foreground">Flexibel</th>
                    <th scope="col" className="p-4 font-heading font-semibold text-xs uppercase tracking-wide text-muted-foreground">Schlagfest</th>
                    <th scope="col" className="p-4 font-heading font-semibold text-xs uppercase tracking-wide text-muted-foreground">Lebensmittel</th>
                    <th scope="col" className="p-4 font-heading font-semibold text-xs uppercase tracking-wide text-muted-foreground">Ideal für</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMaterials.map((m) => {
                    const p = PROPS[m.name];
                    const isHot = p && parseInt(p.tempC) >= 95;
                    return (
                      <tr key={m.id} className="border-t border-border hover:bg-primary/[0.03] transition-colors">
                        <th scope="row" className="p-4 font-heading font-bold text-left text-sm whitespace-nowrap">{m.name}</th>
                        <td className="p-4">
                          {p ? (
                            <span className={`inline-block text-xs font-semibold tabular-nums px-2 py-0.5 rounded border ${
                              isHot
                                ? "border-amber-500/50 text-amber-500 bg-amber-500/5"
                                : "border-border text-muted-foreground bg-muted/30"
                            }`}>
                              {p.tempC}
                            </span>
                          ) : "–"}
                        </td>
                        <td className="p-4">{p ? <Dot state={p.outdoor} label="Aussen" /> : "–"}</td>
                        <td className="p-4">{p ? <Dot state={p.flexible} label="Flexibel" /> : "–"}</td>
                        <td className="p-4">{p ? <Dot state={p.impact} label="Schlagfest" /> : "–"}</td>
                        <td className="p-4">{p ? <Dot state={p.food} label="Lebensmittel" /> : "–"}</td>
                        <td className="p-4 text-muted-foreground text-xs">{(USES[m.name] || []).join(", ") || "–"}</td>
                      </tr>
                    );
                  })}
                  {filteredMaterials.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground text-sm">
                        Keine Materialien für diesen Filter gefunden.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Empfehlungskarte */}
            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              <div className="flex-1 bg-card border border-border rounded-xl px-4 py-3.5 hover:border-primary/40 transition-colors">
                <p className="text-xs font-bold text-primary uppercase tracking-wide mb-1">Tipp</p>
                <p className="text-sm text-muted-foreground">
                  <span className="text-foreground font-medium">Unsicher?</span> Für die meisten B2B-Standardaufträge empfehlen wir{" "}
                  <span className="text-foreground font-semibold">PETG</span> — gutes Preis-Leistungs-Verhältnis, feuchtigkeitsbeständig und lebensmittelecht.
                </p>
              </div>
              <div className="flex-1 bg-card border border-border rounded-xl px-4 py-3.5 hover:border-primary/40 transition-colors">
                <p className="text-xs font-bold text-primary uppercase tracking-wide mb-1">KI-Beratung</p>
                <p className="text-sm text-muted-foreground">
                  <span className="text-foreground font-medium">Unser Konfigurator</span> analysiert Ihr 3D-Modell und schlägt automatisch das optimale Material vor.
                </p>
              </div>
            </div>
          </ScrollReveal>
        </section>
      )}

      <section className="container mx-auto px-4 pb-12">
        <ScrollReveal>
          <h2 className="font-heading text-2xl md:text-3xl font-bold mb-2">Materialien im Detail</h2>
          <p className="text-muted-foreground mb-6 max-w-2xl">
            Eigenschaften, Grenzen, typische Anwendungen und Alternativen – pro Material auf einer Seite
            zusammengefasst.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "PLA", to: "/materialien/pla", hint: "Modelle & Prototypen" },
              { label: "PETG", to: "/materialien/petg", hint: "Funktionsteile" },
              { label: "ABS", to: "/materialien/abs", hint: "temperaturfest" },
              { label: "ASA", to: "/materialien/asa", hint: "wetterfest" },
              { label: "TPU", to: "/materialien/tpu", hint: "flexibel" },
              { label: "Nylon", to: "/materialien/nylon", hint: "abriebfest" },
              { label: "Resin", to: "/materialien/resin", hint: "feinste Details" },
              { label: "Alle Vergleiche", to: "/vergleich", hint: "PLA vs PETG & mehr" },
            ].filter((l) => resin || !isResinText(l.label)).map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="group bg-card border border-border rounded-xl px-4 py-3.5 hover:border-primary/40 transition-colors"
              >
                <span className="flex items-center justify-between gap-2 font-semibold text-sm">
                  {l.label}
                  <ArrowRight className="w-4 h-4 text-primary group-hover:translate-x-0.5 transition-transform" />
                </span>
                <span className="block text-xs text-muted-foreground mt-1">{l.hint}</span>
              </Link>
            ))}
          </div>
        </ScrollReveal>
      </section>

      <section className="container mx-auto px-4 pb-24 text-center">
        <Button asChild size="lg" className="rounded-xl min-h-[52px] px-8">
          <Link to="/kalkulator-online">Preis berechnen <ArrowRight className="w-4 h-4 ml-1.5" /></Link>
        </Button>
      </section>
    </div>
  );
}
