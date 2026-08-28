/**
 * Zentrale Entity-Daten von 3DMuscio.
 * Einzige Quelle der Wahrheit für Seiten, JSON-LD, Footer, llms.txt.
 * Alle Angaben stammen aus bestehenden Website-Inhalten – nichts erfunden.
 */

export const SITE_URL = "https://3dmuscio.com";

export const company = {
  name: "3DMuscio",
  legalName: "3DMuscio",
  category: "3D-Druckservice",
  email: "info@3dmuscio.com",
  url: SITE_URL,
  address: {
    street: "Gartensiedlung 13",
    postalCode: "8360",
    city: "Eschlikon",
    region: "Thurgau",
    regionCode: "TG",
    country: "Schweiz",
    countryCode: "CH",
  },
  /** Kurze, zitierfähige Entity-Beschreibung (identisch überall verwenden) */
  shortDescription:
    "3DMuscio ist ein 3D-Druckservice aus Eschlikon im Kanton Thurgau (Schweiz). Wir fertigen Einzelteile, Prototypen, Funktionsteile, Ersatzteile und Kleinserien im FDM- und SLA/Resin-Verfahren für Privatkunden, KMU, Startups und Unternehmen in der ganzen Schweiz.",
  /** Längere Variante für Über-uns / llms.txt */
  longDescription:
    "3DMuscio ist ein 3D-Druckservice mit Sitz an der Gartensiedlung 13, 8360 Eschlikon TG, Schweiz. Angeboten werden FDM-Druck (PLA, PETG, ABS, ASA, TPU) und SLA/Resin-Druck. Typische Aufträge sind Prototypen, Funktionsteile, Ersatzteile, Modelle und Kleinserien ab 1 Stück – ohne Mindestbestellmenge. Dateien können als STL, STEP, 3MF oder OBJ hochgeladen und im Online-Kalkulator direkt kalkuliert werden. Die Standard-Produktionszeit beträgt 48 Stunden ab Auftragsbestätigung, danach Versand innerhalb der Schweiz oder Abholung in Eschlikon TG.",
  targetMarket: "Schweiz",
  audiences: ["Privatkunden", "KMU", "Startups", "Unternehmen"],
  processes: ["FDM (Fused Deposition Modeling)", "SLA / Resin"],
  services: [
    "Prototypen & Rapid Prototyping",
    "Funktionsteile",
    "Ersatzteile",
    "Kleinserien",
    "Modelle & Sichtteile",
  ],
  materials: ["PLA", "PETG", "ABS", "ASA", "TPU", "Nylon", "Resin"],
  fileFormats: ["STL", "STEP", "3MF", "OBJ"],
  productionTime: "48 Stunden ab Auftragsbestätigung (Standard)",
  tolerance: "typisch ±0.2 mm",
  minOrder: "ab 1 Stück, keine Mindestbestellmenge",
  shipping: "Versand mit Post oder DHL innerhalb der Schweiz, Abholung in Eschlikon TG möglich",
} as const;

export const fullAddress = `${company.address.street}, ${company.address.postalCode} ${company.address.city} ${company.address.regionCode}, ${company.address.country}`;

/** LocalBusiness-Schema – sitewide identisch verwenden */
export const localBusinessJsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": `${SITE_URL}/#organization`,
  name: company.name,
  description: company.shortDescription,
  url: SITE_URL,
  email: company.email,
  address: {
    "@type": "PostalAddress",
    streetAddress: company.address.street,
    postalCode: company.address.postalCode,
    addressLocality: company.address.city,
    addressRegion: company.address.region,
    addressCountry: company.address.countryCode,
  },
  areaServed: { "@type": "Country", name: "Schweiz" },
  knowsAbout: [
    "3D-Druck",
    "FDM 3D-Druck",
    "SLA Resin 3D-Druck",
    "Rapid Prototyping",
    "Ersatzteilfertigung",
    "Kleinserienfertigung",
  ],
};

export const breadcrumbJsonLd = (items: { name: string; path: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((it, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: it.name,
    item: `${SITE_URL}${it.path}`,
  })),
});

export const faqJsonLd = (faqs: { q: string; a: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
});

export const serviceJsonLd = (name: string, description: string, path: string) => ({
  "@context": "https://schema.org",
  "@type": "Service",
  name,
  description,
  serviceType: "3D-Druck",
  url: `${SITE_URL}${path}`,
  provider: { "@id": `${SITE_URL}/#organization` },
  areaServed: { "@type": "Country", name: "Schweiz" },
});
