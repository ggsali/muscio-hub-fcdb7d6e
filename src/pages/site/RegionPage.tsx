import Seo from "@/components/site/Seo";
import AnswerLanding from "@/components/site/AnswerLanding";
import { breadcrumbJsonLd, faqJsonLd, SITE_URL } from "@/data/company";
import { regionBySlug } from "@/data/seo/regionen";

/**
 * Regionale Landingpage (/3d-druck-<region>).
 * Schema: Service + BreadcrumbList + FAQPage.
 * Bewusst KEIN LocalBusiness – der einzige Standort ist Eschlikon TG und wird
 * ausschliesslich über die Organisation auf /3d-druck-schweiz ausgewiesen.
 */
export default function RegionPage({ slug }: { slug: string }) {
  const data = regionBySlug(slug);
  if (!data) return null;

  const path = `/${data.slug}`;

  return (
    <>
      <Seo
        title={data.title}
        description={data.description}
        path={path}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "Service",
            name: `3D-Druck ${data.region}`,
            description: data.description,
            serviceType: "3D-Druck",
            url: `${SITE_URL}${path}`,
            provider: { "@id": `${SITE_URL}/#organization` },
            areaServed: { "@type": data.areaType, name: data.region },
          },
          breadcrumbJsonLd([
            { name: "Start", path: "/" },
            { name: "3D-Druck Schweiz", path: "/3d-druck-schweiz" },
            { name: `3D-Druck ${data.region}`, path },
          ]),
          faqJsonLd(data.faqs),
        ]}
      />
      <AnswerLanding
        eyebrow={data.eyebrow}
        h1={data.h1}
        shortAnswer={data.shortAnswer}
        breadcrumb={[
          { name: "Start", to: "/" },
          { name: "3D-Druck Schweiz", to: "/3d-druck-schweiz" },
          { name: `3D-Druck ${data.region}`, to: path },
        ]}
        sections={data.sections}
        faqs={data.faqs}
        related={data.related}
        ctaTitle={data.ctaTitle}
      />
    </>
  );
}
