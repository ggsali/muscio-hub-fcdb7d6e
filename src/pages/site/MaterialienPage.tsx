import { Link } from "react-router-dom";
import { ScrollReveal } from "@/components/site/ScrollReveal";
import { Button } from "@/components/ui/button";
import { ArrowRight, Layers } from "lucide-react";

const materials = [
  { name: "PLA", tag: "FDM", price: "0.055", desc: "Bio-abbaubar, einfach zu drucken, viele Farben.", uses: ["Prototypen", "Modelle", "Dekoration"] },
  { name: "PETG", tag: "FDM", price: "0.065", desc: "Schlagzäh, chemisch beständig, lebensmittelecht.", uses: ["Funktionsteile", "Behälter", "Outdoor"] },
  { name: "ABS / ASA", tag: "FDM", price: "0.075", desc: "Hitzebeständig, UV-stabil, mechanisch robust.", uses: ["Industrie", "Automotive", "Outdoor"] },
  { name: "TPU", tag: "FDM", price: "0.090", desc: "Flexibel, gummiartig, abriebfest.", uses: ["Dichtungen", "Griffe", "Sport"] },
  { name: "Nylon", tag: "FDM", price: "0.120", desc: "Sehr fest, abriebfest, geringe Reibung.", uses: ["Zahnräder", "Lager", "Werkzeuge"] },
  { name: "Resin", tag: "SLA", price: "0.120", desc: "Höchste Detailgenauigkeit, glatte Oberflächen.", uses: ["Schmuck", "Miniaturen", "Dental"] },
];

export default function MaterialienPage() {
  return (
    <div>
      <section className="container mx-auto px-4 pt-20 pb-12">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {materials.map((m, i) => (
            <ScrollReveal key={m.name} delay={i * 0.05}>
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
                <p className="text-sm text-muted-foreground mb-4">{m.desc}</p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {m.uses.map(u => (
                    <span key={u} className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">{u}</span>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <span className="text-xs text-muted-foreground">ab</span>
                  <span className="font-heading font-extrabold text-primary">CHF {m.price}/g</span>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>

        <div className="mt-16 text-center">
          <Button asChild size="lg" className="rounded-full">
            <Link to="/kalkulator-online">Preis berechnen <ArrowRight className="w-4 h-4 ml-1.5" /></Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
