import { Link, Navigate, useParams } from "@/lib/router-compat";
import Seo from "@/components/site/Seo";
import AnswerLanding from "@/components/site/AnswerLanding";
import { comparisons, getComparison } from "@/data/seo/comparisons";
import { breadcrumbJsonLd, faqJsonLd, SITE_URL } from "@/data/company";
import { ScrollReveal } from "@/components/site/ScrollReveal";
import { ArrowRight } from "lucide-react";

const VergleichIndex = () => (
  <>
    <Seo
      title="3D-Druck Vergleiche: Materialien & Verfahren | 3DMuscio"
      description="Materialien und Verfahren im direkten Vergleich: PLA vs PETG, PETG vs ABS, ABS vs ASA, FDM vs SLA, 3D-Druck vs CNC und Spritzguss."
      path="/vergleich"
      jsonLd={breadcrumbJsonLd([
        { name: "Start", path: "/" },
        { name: "Vergleiche", path: "/vergleich" },
      ])}
    />
    <div className="pt-12 pb-20">
      <div className="container mx-auto px-4 max-w-4xl">
        <ScrollReveal>
          <header className="mb-10">
            <p className="text-xs font-bold text-primary uppercase tracking-[0.2em] mb-3">Wissen</p>
            <h1 className="font-heading text-3xl md:text-5xl font-extrabold leading-tight mb-5">
              3D-Druck Vergleiche – Materialien und Verfahren
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Welches Material, welches Verfahren? Diese Vergleiche beantworten die Frage jeweils in
              wenigen Sätzen – inklusive Tabelle und klarer Empfehlung.
            </p>
          </header>
        </ScrollReveal>
        <div className="grid sm:grid-cols-2 gap-3">
          {comparisons.map((c) => (
            <Link
              key={c.slug}
              to={`/vergleich/${c.slug}`}
              className="group bg-card border border-border rounded-xl p-5 hover:border-primary/40 transition-colors"
            >
              <span className="flex items-center justify-between gap-2 font-semibold">
                {c.h1.split(" – ")[0]}
                <ArrowRight className="w-4 h-4 text-primary group-hover:translate-x-0.5 transition-transform" />
              </span>
              <span className="block text-sm text-muted-foreground mt-2 leading-relaxed">
                {c.shortAnswer.replace("Kurz gesagt: ", "").slice(0, 130)}…
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  </>
);

export default function VergleichPage() {
  const { slug } = useParams();
  if (!slug) return <VergleichIndex />;

  const cmp = getComparison(slug);
  if (!cmp) return <Navigate to="/vergleich" replace />;

  const path = `/vergleich/${cmp.slug}`;

  return (
    <>
      <Seo
        title={cmp.title}
        description={cmp.description}
        path={path}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: cmp.h1,
            description: cmp.description,
            url: `${SITE_URL}${path}`,
            publisher: { "@id": `${SITE_URL}/#organization` },
          },
          breadcrumbJsonLd([
            { name: "Start", path: "/" },
            { name: "Vergleiche", path: "/vergleich" },
            { name: cmp.h1, path },
          ]),
          faqJsonLd(cmp.faqs),
        ]}
      />
      <AnswerLanding
        eyebrow="Vergleich"
        h1={cmp.h1}
        shortAnswer={cmp.shortAnswer}
        breadcrumb={[
          { name: "Start", to: "/" },
          { name: "Vergleiche", to: "/vergleich" },
          { name: cmp.h1.split(" – ")[0], to: path },
        ]}
        table={cmp.table}
        sections={cmp.sections}
        faqs={cmp.faqs}
        related={cmp.related}
      />
    </>
  );
}
