import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/site/ScrollReveal";
import { ArrowRight, Boxes, Cog, Layers, Package, Sparkles, Wrench } from "lucide-react";
import Seo from "@/components/site/Seo";

const serviceJsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "3D Druckservice Schweiz",
  provider: { "@type": "LocalBusiness", name: "3DMuscio" },
  serviceType: "3D Druck",
  description:
    "FDM und SLA 3D Druckservice für B2B-Kunden in der Schweiz. Materialien: PLA, PETG, ABS, ASA, TPU, Resin.",
  areaServed: "CH",
  url: "https://3dmuscio.com/leistungen",
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "3D Druckleistungen",
    itemListElement: [
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "FDM 3D Druck" } },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "SLA Resin Druck" } },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Prototypenentwicklung" } },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Kleinserienfertigung" } },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Ersatzteile herstellen" } },
    ],
  },
};

const services = [
  {
    icon: Layers,
    title: "FDM 3D Druck",
    text: "Robuste Teile in PLA, PETG, ABS, ASA und TPU – für Funktionsteile, Gehäuse und Halterungen.",
    to: "/leistungen/fdm-3d-druck",
    cta: "Zum FDM Druck",
  },
  {
    icon: Sparkles,
    title: "SLA Resin Druck",
    text: "Feine Details und glatte Oberflächen für Miniaturen, Sichtteile und filigrane Geometrien.",
    to: "/leistungen/sla-3d-druck",
    cta: "Zum SLA Druck",
  },
  {
    icon: Cog,
    title: "Prototypen & Rapid Prototyping",
    text: "Funktionsmodelle und Designmuster in wenigen Tagen – iterieren, ohne Werkzeugkosten.",
    to: "/prototypen",
    cta: "Zu Prototypen",
  },
  {
    icon: Boxes,
    title: "Kleinserienfertigung",
    text: "Serien ab 1 Stück ohne Spritzgussform und ohne Mindestbestellmenge.",
    to: "/kleinserien",
    cta: "Zu Kleinserien",
  },
  {
    icon: Wrench,
    title: "Ersatzteile",
    text: "Nicht mehr lieferbare Teile nach STL, Zeichnung oder Muster neu fertigen.",
    to: "/ersatzteile",
    cta: "Zu Ersatzteilen",
  },
  {
    icon: Package,
    title: "Nachbearbeitung & Montage",
    text: "Entfernen von Stützstrukturen, Schleifen, Bohren und einfache Baugruppenmontage.",
    to: "/kontakt",
    cta: "Anfrage senden",
  },
];

export default function LeistungenPage() {
  return (
    <div className="pt-12 pb-20">
      <Seo
        title="Leistungen – FDM & SLA 3D Druck, Prototypen, Kleinserien | 3DMuscio"
        description="Alle Leistungen von 3DMuscio: FDM und SLA 3D Druck, Rapid Prototyping, Kleinserienfertigung und Ersatzteile – gefertigt in Eschlikon TG für Kunden in der ganzen Schweiz."
        path="/leistungen"
        jsonLd={serviceJsonLd}
      />
      <div className="container mx-auto px-4 max-w-5xl">
        <ScrollReveal>
          <header className="mb-12 max-w-3xl">
            <p className="text-xs font-bold text-primary uppercase tracking-[0.2em] mb-3">Leistungen</p>
            <h1 className="font-heading text-3xl md:text-5xl font-extrabold leading-tight mb-5">
              3D Druck Leistungen für Unternehmen und Privatkunden
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed">
              3DMuscio fertigt Einzelteile, Prototypen, Kleinserien und Ersatzteile im FDM und SLA
              Verfahren – ab einem Stück, mit transparenten Preisen und Lieferung in die ganze Schweiz.
            </p>
            <div className="flex flex-wrap gap-3 mt-7">
              <Button asChild className="rounded-full font-bold">
                <Link to="/kalkulator-online">Preis berechnen</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full">
                <Link to="/kontakt">Anfrage senden</Link>
              </Button>
            </div>
          </header>
        </ScrollReveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((s) => (
            <ScrollReveal key={s.title}>
              <article className="h-full bg-card border border-border rounded-xl p-6 flex flex-col">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <s.icon className="w-5 h-5 text-primary" />
                </div>
                <h2 className="font-heading text-lg font-bold mb-2">{s.title}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed flex-1">{s.text}</p>
                <Link
                  to={s.to}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                >
                  {s.cta}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </article>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal>
          <section className="mt-16">
            <h2 className="font-heading text-2xl font-bold mb-2">Detailseiten und Entscheidungshilfen</h2>
            <p className="text-muted-foreground mb-6 max-w-2xl">
              Ausführliche Informationen zu Verfahren, Materialien und Kosten – jeweils mit direkter
              Antwort, Vergleichstabelle und häufigen Fragen.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { label: "FDM 3D-Druck", to: "/leistungen/fdm-3d-druck" },
                { label: "SLA / Resin 3D-Druck", to: "/leistungen/sla-3d-druck" },
                { label: "Prototypen", to: "/leistungen/3d-druck-prototypen" },
                { label: "Ersatzteile", to: "/leistungen/3d-druck-ersatzteile" },
                { label: "Kleinserien", to: "/leistungen/3d-druck-kleinserien" },
                { label: "3D-Druck Kosten Schweiz", to: "/wissen/3d-druck-kosten-schweiz" },
                { label: "FDM vs SLA", to: "/vergleich/fdm-vs-sla" },
                { label: "3D-Druck vs Spritzguss", to: "/vergleich/3d-druck-vs-spritzguss" },
                { label: "Alle Vergleiche", to: "/vergleich" },
              ].map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  className="group flex items-center justify-between gap-2 bg-card border border-border rounded-xl px-4 py-3.5 text-sm font-semibold hover:border-primary/40 transition-colors"
                >
                  {l.label}
                  <ArrowRight className="w-4 h-4 text-primary group-hover:translate-x-0.5 transition-transform" />
                </Link>
              ))}
            </div>
          </section>
        </ScrollReveal>


        <ScrollReveal>
          <section className="mt-16 bg-card border border-border rounded-2xl p-8 text-center">
            <h2 className="font-heading text-2xl font-bold mb-2">Projekt in Arbeit?</h2>
            <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
              Lade deine STL- oder STEP-Datei hoch und erhalte sofort einen transparenten Preis –
              ohne Mindestbestellmenge.
            </p>
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
}
