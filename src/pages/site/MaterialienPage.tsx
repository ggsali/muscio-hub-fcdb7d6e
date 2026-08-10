import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { ScrollReveal } from "@/components/site/ScrollReveal";
import { Button } from "@/components/ui/button";
import { ArrowRight, Layers, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Seo from "@/components/site/Seo";

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
}

const PROPS: Record<string, MatProps> = {
  PLA: { strength: 3, temp: 1, uv: 1, chemical: 2, tempC: "bis 55 °C" },
  PETG: { strength: 4, temp: 3, uv: 3, chemical: 4, tempC: "bis 75 °C" },
  ABS: { strength: 4, temp: 4, uv: 2, chemical: 3, tempC: "bis 95 °C" },
  ASA: { strength: 4, temp: 4, uv: 5, chemical: 4, tempC: "bis 100 °C" },
  "ABS/ASA": { strength: 4, temp: 4, uv: 4, chemical: 4, tempC: "bis 100 °C" },
  TPU: { strength: 3, temp: 2, uv: 3, chemical: 3, tempC: "bis 70 °C" },
  Nylon: { strength: 5, temp: 4, uv: 2, chemical: 4, tempC: "bis 110 °C" },
  Resin: { strength: 2, temp: 2, uv: 1, chemical: 2, tempC: "bis 60 °C" },
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
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

      {/* Vergleichstabelle */}
      {!loading && !error && materials.length > 0 && (
        <section className="container mx-auto px-4 pb-16">
          <ScrollReveal>
            <h2 className="font-heading text-2xl md:text-3xl font-bold tracking-tight mb-6">
              Materialien im Vergleich
            </h2>
            <div className="overflow-x-auto rounded-2xl border border-border bg-card">
              <table className="w-full text-sm min-w-[720px]">
                <caption className="sr-only">
                  Vergleich der 3D-Druck-Materialien nach Festigkeit, Temperatur-, UV- und Chemikalienbeständigkeit
                </caption>
                <thead>
                  <tr className="bg-muted/50 text-left">
                    <th scope="col" className="p-4 font-heading font-semibold">Material</th>
                    <th scope="col" className="p-4 font-heading font-semibold">Festigkeit</th>
                    <th scope="col" className="p-4 font-heading font-semibold">Temperatur</th>
                    <th scope="col" className="p-4 font-heading font-semibold">UV</th>
                    <th scope="col" className="p-4 font-heading font-semibold">Chemikalien</th>
                    <th scope="col" className="p-4 font-heading font-semibold">Typisch für</th>
                    <th scope="col" className="p-4 font-heading font-semibold text-right">Preis</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map((m) => {
                    const p = PROPS[m.name];
                    return (
                      <tr key={m.id} className="border-t border-border">
                        <th scope="row" className="p-4 font-semibold text-left">{m.name}</th>
                        <td className="p-4">{p ? `${p.strength}/5` : "–"}</td>
                        <td className="p-4">{p ? p.tempC : "–"}</td>
                        <td className="p-4">{p ? `${p.uv}/5` : "–"}</td>
                        <td className="p-4">{p ? `${p.chemical}/5` : "–"}</td>
                        <td className="p-4 text-muted-foreground">{(USES[m.name] || []).join(", ") || "–"}</td>
                        <td className="p-4 text-right tabular-nums whitespace-nowrap">
                          CHF {fmtPrice(m.price_per_gram)}/g
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </ScrollReveal>
        </section>
      )}

      <section className="container mx-auto px-4 pb-24 text-center">
        <Button asChild size="lg" className="rounded-xl min-h-[52px] px-8">
          <Link to="/kalkulator-online">Preis berechnen <ArrowRight className="w-4 h-4 ml-1.5" /></Link>
        </Button>
      </section>
    </div>
  );
}
