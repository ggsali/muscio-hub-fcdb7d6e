import { Navigate, useParams } from "react-router-dom";
import Seo from "@/components/site/Seo";
import AnswerLanding from "@/components/site/AnswerLanding";
import { getLocation } from "@/data/seo/locations";
import { breadcrumbJsonLd, company, faqJsonLd, SITE_URL } from "@/data/company";

export default function StandortPage() {
  const { slug } = useParams();
  const loc = getLocation(slug);

  if (!loc) return <Navigate to="/kontakt" replace />;

  const path = `/standorte/${loc.slug}`;

  return (
    <>
      <Seo
        title={loc.title}
        description={loc.description}
        path={path}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "Service",
            name: `3D-Druckservice ${loc.region}`,
            description: loc.description,
            serviceType: "3D-Druck",
            url: `${SITE_URL}${path}`,
            provider: { "@id": `${SITE_URL}/#organization` },
            areaServed: { "@type": "AdministrativeArea", name: loc.region },
          },
          breadcrumbJsonLd([
            { name: "Start", path: "/" },
            { name: "Standorte", path: "/kontakt" },
            { name: loc.region, path },
          ]),
          faqJsonLd(loc.faqs),
        ]}
      />
      <AnswerLanding
        eyebrow={`Region ${loc.region}`}
        h1={loc.h1}
        shortAnswer={loc.shortAnswer}
        breadcrumb={[
          { name: "Start", to: "/" },
          { name: "Kontakt", to: "/kontakt" },
          { name: loc.region, to: path },
        ]}
        sections={[
          ...loc.sections,
          {
            title: "Standort und Kontakt",
            bullets: [
              `${company.name}, ${company.address.street}, ${company.address.postalCode} ${company.address.city} ${company.address.regionCode}`,
              `E-Mail: ${company.email}`,
              `Produktionszeit: ${company.productionTime}`,
              `Verfahren: ${company.processes.join(" und ")}`,
            ],
          },
        ]}
        faqs={loc.faqs}
        related={loc.related}
        ctaTitle={`3D-Druck in ${loc.region} anfragen`}
        ctaText="Datei hochladen und Preis sofort berechnen – oder Anfrage mit Fotos und Maßen senden."
      />
    </>
  );
}
