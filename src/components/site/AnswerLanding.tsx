import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/site/ScrollReveal";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { ArrowRight, Check, ChevronRight, Printer } from "lucide-react";

export interface AnswerSection {
  title: string;
  text?: string;
  bullets?: string[];
}

export interface AnswerTable {
  title?: string;
  headers: string[];
  rows: string[][];
}

export interface AnswerFaq {
  q: string;
  a: string;
}

export interface RelatedLink {
  label: string;
  to: string;
  text?: string;
}

interface AnswerLandingProps {
  eyebrow: string;
  h1: string;
  /** Kurze, direkte Antwort (2–4 Sätze) – wird als zitierfähiger Block dargestellt */
  shortAnswer: string;
  breadcrumb: { name: string; to: string }[];
  sections?: AnswerSection[];
  table?: AnswerTable;
  faqs?: AnswerFaq[];
  related?: RelatedLink[];
  ctaTitle?: string;
  ctaText?: string;
}

export const AnswerLanding = ({
  eyebrow,
  h1,
  shortAnswer,
  breadcrumb,
  sections = [],
  table,
  faqs = [],
  related = [],
  ctaTitle = "Preis in 60 Sekunden berechnen",
  ctaText = "Datei hochladen, Material wählen, Preis sehen – ohne Anmeldung.",
}: AnswerLandingProps) => (
  <div className="pt-8 pb-20">
    <div className="container mx-auto px-4 max-w-4xl">
      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {breadcrumb.map((b, i) => (
            <li key={b.to} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="w-3 h-3 opacity-50" />}
              {i === breadcrumb.length - 1 ? (
                <span className="text-foreground/70">{b.name}</span>
              ) : (
                <Link to={b.to} className="hover:text-primary transition-colors">{b.name}</Link>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <ScrollReveal>
        <header className="mb-10">
          <p className="text-xs font-bold text-primary uppercase tracking-[0.2em] mb-3">{eyebrow}</p>
          <h1 className="font-heading text-3xl md:text-5xl font-extrabold leading-tight mb-6">{h1}</h1>
          <div className="bg-card border border-border rounded-2xl p-5 md:p-6">
            <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Kurz gesagt</p>
            <p className="text-base md:text-lg leading-relaxed text-foreground/90">{shortAnswer}</p>
          </div>
          <div className="flex flex-wrap gap-3 mt-6">
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
        {sections.map((s) => (
          <ScrollReveal key={s.title}>
            <section>
              <h2 className="font-heading text-xl md:text-2xl font-bold mb-3">{s.title}</h2>
              {s.text && <p className="text-muted-foreground leading-relaxed">{s.text}</p>}
              {s.bullets && (
                <ul className="mt-4 grid sm:grid-cols-2 gap-2.5">
                  {s.bullets.map((t) => (
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

      {table && (
        <ScrollReveal>
          <section className="mt-12">
            <h2 className="font-heading text-xl md:text-2xl font-bold mb-4">
              {table.title || "Vergleich auf einen Blick"}
            </h2>
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-card">
                  <tr>
                    {table.headers.map((h) => (
                      <th key={h} className="text-left font-semibold px-4 py-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row) => (
                    <tr key={row[0]} className="border-t border-border">
                      {row.map((cell, i) => (
                        <td
                          key={i}
                          className={`px-4 py-3 align-top ${i === 0 ? "font-medium" : "text-muted-foreground"}`}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </ScrollReveal>
      )}

      {faqs.length > 0 && (
        <ScrollReveal>
          <section className="mt-14">
            <h2 className="font-heading text-xl md:text-2xl font-bold mb-4">Häufige Fragen</h2>
            <Accordion type="single" collapsible className="space-y-2">
              {faqs.map((f, i) => (
                <AccordionItem
                  key={f.q}
                  value={`faq-${i}`}
                  className="bg-card border border-border rounded-xl px-4"
                >
                  <AccordionTrigger className="text-left text-sm font-medium py-4">{f.q}</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        </ScrollReveal>
      )}

      {related.length > 0 && (
        <ScrollReveal>
          <section className="mt-14">
            <h2 className="font-heading text-xl md:text-2xl font-bold mb-4">Passend dazu</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {related.map((r) => (
                <Link
                  key={r.to}
                  to={r.to}
                  className="group bg-card border border-border rounded-xl p-4 hover:border-primary/40 transition-colors"
                >
                  <span className="flex items-center justify-between gap-2 font-semibold text-sm">
                    {r.label}
                    <ArrowRight className="w-4 h-4 text-primary group-hover:translate-x-0.5 transition-transform" />
                  </span>
                  {r.text && <span className="block text-xs text-muted-foreground mt-1.5">{r.text}</span>}
                </Link>
              ))}
            </div>
          </section>
        </ScrollReveal>
      )}

      <ScrollReveal>
        <section className="mt-14 bg-card border border-border rounded-2xl p-6 md:p-8 text-center">
          <h2 className="font-heading text-xl md:text-2xl font-bold mb-2">{ctaTitle}</h2>
          <p className="text-sm text-muted-foreground mb-5 max-w-xl mx-auto">{ctaText}</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button asChild className="rounded-full font-bold">
              <Link to="/kalkulator-online">
                <Printer className="w-4 h-4 mr-2" />
                Zum Kalkulator
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/kontakt">Kontakt aufnehmen</Link>
            </Button>
          </div>
        </section>
      </ScrollReveal>
    </div>
  </div>
);

export default AnswerLanding;
