import { Navigate, useParams } from "@/lib/router-compat";
import Seo from "@/components/site/Seo";
import AnswerLanding from "@/components/site/AnswerLanding";
import { getMaterial } from "@/data/seo/materials";
import { breadcrumbJsonLd, faqJsonLd, SITE_URL } from "@/data/company";

export default function MaterialDetailPage() {
  const { slug } = useParams();
  const material = getMaterial(slug);

  if (!material) return <Navigate to="/materialien" replace />;

  const path = `/materialien/${material.slug}`;

  return (
    <>
      <Seo
        title={material.title}
        description={material.description}
        path={path}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: material.h1,
            description: material.description,
            about: material.name,
            url: `${SITE_URL}${path}`,
            publisher: { "@id": `${SITE_URL}/#organization` },
          },
          breadcrumbJsonLd([
            { name: "Start", path: "/" },
            { name: "Materialien", path: "/materialien" },
            { name: material.name, path },
          ]),
          faqJsonLd(material.faqs),
        ]}
      />
      <AnswerLanding
        eyebrow={`Material · ${material.process}`}
        h1={material.h1}
        shortAnswer={material.shortAnswer}
        breadcrumb={[
          { name: "Start", to: "/" },
          { name: "Materialien", to: "/materialien" },
          { name: material.name, to: path },
        ]}
        sections={material.sections}
        table={material.table}
        faqs={material.faqs}
        related={material.related}
        ctaTitle={`${material.name} jetzt kalkulieren`}
        ctaText="Datei hochladen, Material wählen, Preis sofort sehen – ohne Anmeldung."
      />
    </>
  );
}
