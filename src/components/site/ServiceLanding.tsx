import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/site/ScrollReveal";
import { ArrowRight, Check, Printer } from "lucide-react";

export interface ServiceBlock {
  title: string;
  text?: string;
  bullets?: string[];
}

interface ServiceLandingProps {
  eyebrow: string;
  h1: string;
  lead: string;
  blocks: ServiceBlock[];
  steps?: { title: string; text: string }[];
  ctaTitle: string;
  ctaText: string;
}

export const ServiceLanding = ({ eyebrow, h1, lead, blocks, steps, ctaTitle, ctaText }: ServiceLandingProps) => (
  <div className="pt-12 pb-20">
    <div className="container mx-auto px-4 max-w-4xl">
      <ScrollReveal>
        <header className="mb-12">
          <p className="text-xs font-bold text-primary uppercase tracking-[0.2em] mb-3">{eyebrow}</p>
          <h1 className="font-heading text-3xl md:text-5xl font-extrabold leading-tight mb-5">{h1}</h1>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-3xl">{lead}</p>
          <div className="flex flex-wrap gap-3 mt-7">
            <Button asChild className="rounded-full font-bold">
              <Link to="/kalkulator-online">
                <Printer className="w-4 h-4 mr-2" />
                Preis berechnen
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/kontakt">Anfrage senden</Link>
            </Button>
          </div>
        </header>
      </ScrollReveal>

      <div className="space-y-10">
        {blocks.map((b) => (
          <ScrollReveal key={b.title}>
            <section>
              <h2 className="font-heading text-xl md:text-2xl font-bold mb-3">{b.title}</h2>
              {b.text && <p className="text-muted-foreground leading-relaxed">{b.text}</p>}
              {b.bullets && (
                <ul className="mt-4 grid sm:grid-cols-2 gap-2.5">
                  {b.bullets.map((t) => (
                    <li key={t} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </ScrollReveal>
        ))}
      </div>

      {steps && steps.length > 0 && (
        <ScrollReveal>
          <section className="mt-14">
            <h2 className="font-heading text-xl md:text-2xl font-bold mb-6">So läuft es ab</h2>
            <ol className="grid sm:grid-cols-2 gap-4">
              {steps.map((s, i) => (
                <li key={s.title} className="bg-card border border-border rounded-xl p-5">
                  <span className="text-xs font-bold text-primary">Schritt {i + 1}</span>
                  <h3 className="font-semibold mt-1 mb-1.5">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.text}</p>
                </li>
              ))}
            </ol>
          </section>
        </ScrollReveal>
      )}

      <ScrollReveal>
        <section className="mt-16 bg-card border border-border rounded-2xl p-8 text-center">
          <h2 className="font-heading text-2xl font-bold mb-2">{ctaTitle}</h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">{ctaText}</p>
          <Button asChild size="lg" className="rounded-full font-bold">
            <Link to="/kalkulator-online">
              Jetzt Preis berechnen
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </section>
      </ScrollReveal>
    </div>
  </div>
);

export default ServiceLanding;
