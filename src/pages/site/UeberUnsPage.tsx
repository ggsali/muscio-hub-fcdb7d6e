import { ScrollReveal } from "@/components/site/ScrollReveal";
import { Award, Heart, Zap, ShieldCheck } from "lucide-react";
import werkstatt from "@/assets/werkstatt.jpg";

const values = [
  { icon: Award, title: "Schweizer Qualität", text: "Jedes Teil sorgfältig geprüft, bevor es das Haus verlässt." },
  { icon: Zap, title: "48h Lieferzeit", text: "Vom Upload bis zur Lieferung — schnell und zuverlässig." },
  { icon: ShieldCheck, title: "Vertraulich", text: "Deine Dateien werden niemals weitergegeben." },
  { icon: Heart, title: "Fair kalkuliert", text: "Transparente Preise ohne versteckte Kosten." },
];

export default function UeberUnsPage() {
  return (
    <div>
      <section className="container mx-auto px-4 pt-12 pb-12">
        <ScrollReveal>
          <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">Über uns</p>
          <h1 className="font-heading text-4xl md:text-6xl font-extrabold tracking-tight mb-6 max-w-3xl">
            3D-Druck mit Leidenschaft <span className="text-primary">aus der Schweiz.</span>
          </h1>
          <p className="text-muted-foreground max-w-2xl text-lg leading-relaxed">
            3DMuscio ist dein Partner für professionellen 3D-Druck. Vom Prototyp bis zur Kleinserie —
            präzise, schnell und mit persönlicher Beratung.
          </p>
        </ScrollReveal>
      </section>

      <section className="container mx-auto px-4 pb-16">
        <ScrollReveal>
          <div className="rounded-3xl overflow-hidden border border-border">
            <img src={werkstatt} alt="Unsere Werkstatt" className="w-full h-[300px] md:h-[480px] object-cover" />
          </div>
        </ScrollReveal>
      </section>

      <section className="container mx-auto px-4 pb-28">
        <ScrollReveal>
          <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">Werte</p>
          <h2 className="font-heading text-3xl md:text-4xl font-bold tracking-tight mb-12">Was uns ausmacht.</h2>
        </ScrollReveal>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {values.map((v, i) => (
            <ScrollReveal key={v.title} delay={i * 0.08}>
              <div className="bg-card border border-border rounded-2xl p-6 h-full">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <v.icon className="w-4 h-4 text-primary" />
                </div>
                <h3 className="font-heading font-bold mb-2">{v.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{v.text}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>
    </div>
  );
}
