import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { ScrollReveal } from "@/components/site/ScrollReveal";
import { Button } from "@/components/ui/button";
import { ArrowRight, Layers, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
  "ABS/ASA": ["Industrie", "Automotive", "Outdoor"],
  TPU: ["Dichtungen", "Griffe", "Sport"],
  Nylon: ["Zahnräder", "Lager", "Werkzeuge"],
  Resin: ["Schmuck", "Miniaturen", "Dental"],
};

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
      <section className="container mx-auto px-4 pt-12 pb-12">
        <ScrollReveal>
          <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">Materialien</p>
          <h1 className="font-heading text-4xl md:text-6xl font-extrabold tracking-tight mb-4">
            Für jeden Einsatz<br /><span className="text-primary">das richtige Material.</span>
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Wir drucken mit hochwertigen Materialien in vielen Farben. Unsicher? Wir beraten gerne.
          </p>
        </ScrollReveal>
      </section>

      <section className="container mx-auto px-4 pb-24">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="text-center py-20 text-destructive">{error}</div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {materials.map((m, i) => {
            const uses = USES[m.name] || [];
            const price = Number(m.price_per_gram).toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
            return (
            <ScrollReveal key={m.id} delay={i * 0.05}>
              <div className="bg-card border border-border rounded-2xl p-6 hover:border-primary/40 transition-colors h-full">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Layers className="w-4 h-4 text-primary" />
                    </div>
                    <h3 className="font-heading text-xl font-bold">{m.name}</h3>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-muted tracking-wider">{m.tag}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">{m.description}</p>
                {uses.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {uses.map(u => (
                      <span key={u} className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">{u}</span>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <span className="text-xs text-muted-foreground">ab</span>
                  <span className="font-heading font-extrabold text-primary">CHF {price}/g</span>
                </div>
              </div>
            </ScrollReveal>
            );
          })}
        </div>
        )}

        <div className="mt-16 text-center">
          <Button asChild size="lg" className="rounded-full">
            <Link to="/kalkulator-online">Preis berechnen <ArrowRight className="w-4 h-4 ml-1.5" /></Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
