import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowRight, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollReveal } from "@/components/site/ScrollReveal";

export interface DbFaq { frage: string; antwort: string }

interface DbContentPageProps {
  eyebrow?: string;
  h1: string;
  intro?: string | null;
  /** Markdown-Inhalt aus der Datenbank */
  inhalt?: string | null;
  faq?: DbFaq[];
  breadcrumb: { name: string; to: string }[];
  ctaTitle?: string;
  ctaText?: string;
  /** Zusätzliche interne Links am Seitenende */
  related?: { label: string; to: string; text?: string }[];
}

/**
 * Darstellung für Seiteninhalte, die aus der Datenbank kommen
 * (Leistungs- und lokale Landingpages). Markdown wird gerendert,
 * interne Links laufen über den Router.
 */
export default function DbContentPage({
  eyebrow, h1, intro, inhalt, faq = [], breadcrumb, ctaTitle, ctaText, related = [],
}: DbContentPageProps) {
  return (
    <div className="pb-20">
      <section className="border-b border-border/50 bg-muted/20">
        <div className="container mx-auto px-4 sm:px-6 py-10 md:py-14 max-w-3xl">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground mb-4">
            {breadcrumb.map((b, i) => (
              <span key={b.to} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="w-3 h-3" />}
                {i === breadcrumb.length - 1 ? (
                  <span className="text-foreground">{b.name}</span>
                ) : (
                  <Link to={b.to} className="hover:text-foreground transition-colors">{b.name}</Link>
                )}
              </span>
            ))}
          </nav>

          {eyebrow && (
            <div className="text-[11px] uppercase tracking-[0.18em] text-primary font-semibold mb-2">{eyebrow}</div>
          )}
          <h1 className="font-heading text-2xl md:text-4xl font-bold tracking-tight mb-4">{h1}</h1>
          {intro && <p className="text-base md:text-lg text-muted-foreground leading-relaxed">{intro}</p>}

          <div className="flex flex-wrap gap-2 mt-6">
            <Button asChild size="sm">
              <Link to="/kalkulator-online">Preis berechnen <ArrowRight className="w-4 h-4 ml-1" /></Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/kontakt">Anfrage senden</Link>
            </Button>
          </div>
        </div>
      </section>

      {inhalt && (
        <section className="container mx-auto px-4 sm:px-6 py-10 md:py-14 max-w-3xl">
          <ScrollReveal>
            <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none prose-headings:font-heading prose-headings:tracking-tight prose-a:text-primary">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ href, children }) =>
                    href && href.startsWith("/") ? (
                      <Link to={href}>{children}</Link>
                    ) : (
                      <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
                    ),
                }}
              >
                {inhalt}
              </ReactMarkdown>
            </div>
          </ScrollReveal>
        </section>
      )}

      {faq.length > 0 && (
        <section className="container mx-auto px-4 sm:px-6 pb-10 max-w-3xl">
          <h2 className="font-heading text-xl md:text-2xl font-bold mb-4">Häufige Fragen</h2>
          <Accordion type="single" collapsible className="w-full">
            {faq.map((f, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-left text-sm md:text-base">{f.frage}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                  {f.antwort}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      )}

      {related.length > 0 && (
        <section className="container mx-auto px-4 sm:px-6 pb-10 max-w-3xl">
          <h2 className="font-heading text-xl md:text-2xl font-bold mb-4">Passend dazu</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {related.map(r => (
              <Link
                key={r.to}
                to={r.to}
                className="block rounded-xl border border-border bg-card p-4 hover:border-primary/50 transition-colors"
              >
                <div className="font-medium text-sm flex items-center gap-1">
                  {r.label} <ArrowRight className="w-3.5 h-3.5 text-primary" />
                </div>
                {r.text && <div className="text-xs text-muted-foreground mt-1">{r.text}</div>}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="container mx-auto px-4 sm:px-6 max-w-3xl">
        <div className="rounded-2xl border border-border bg-muted/30 p-6 md:p-8 text-center">
          <h2 className="font-heading text-xl md:text-2xl font-bold mb-2">
            {ctaTitle ?? "Jetzt Preis berechnen"}
          </h2>
          <p className="text-sm text-muted-foreground mb-5">
            {ctaText ?? "Datei hochladen, Material wählen, Preis sofort sehen – ohne Anmeldung."}
          </p>
          <Button asChild size="lg">
            <Link to="/kalkulator-online">Preis berechnen <ArrowRight className="w-4 h-4 ml-1" /></Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
