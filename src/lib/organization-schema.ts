// Einzige sitewide JSON-LD-Quelle: LocalBusiness (@id #organization) + Service + WebSite.
// Seiten dürfen diese Entität NICHT erneut ausgeben (sonst doppelte/widersprüchliche Knoten);
// Bewertungen werden über buildOrganizationJsonLd(rating) in genau diesen Knoten eingefügt.
export type OrgRatingData = { aggregateRating?: Record<string, unknown>; review?: Record<string, unknown>[] };

export const buildOrganizationJsonLd = (rating: OrgRatingData = {}) => ({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": ["LocalBusiness", "ProfessionalService"],
      "@id": "https://3dmuscio.com/#organization",
      name: "3DMuscio",
      description:
        "Schweizer 3D-Druckservice für Prototypen, Ersatzteile und Kleinserien. FDM und SLA 3D-Druck aus Eschlikon TG.",
      url: "https://3dmuscio.com",
      email: "info@3dmuscio.com",
      telephone: "+41778044122",
      founder: { "@type": "Person", name: "Jorim Moos" },
      foundingDate: "2024",
      image:
        "https://ukqtjdsjmtxgzhklvqky.supabase.co/storage/v1/object/public/company-assets/logo.jpeg",
      logo: "https://ukqtjdsjmtxgzhklvqky.supabase.co/storage/v1/object/public/company-assets/logo.jpeg",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Eschlikon",
        addressRegion: "Thurgau",
        addressCountry: "CH",
      },
      geo: { "@type": "GeoCoordinates", latitude: 47.6537, longitude: 8.9736 },
      areaServed: [{ "@type": "Country", name: "Schweiz" }, { "@type": "Country", name: "Liechtenstein" }],
      knowsAbout: ["3D-Druck", "FDM 3D-Druck", "SLA Resin 3D-Druck", "Rapid Prototyping", "Ersatzteilfertigung", "Kleinserienfertigung"],
      ...rating,
      serviceType: ["FDM 3D-Druck", "SLA 3D-Druck", "Rapid Prototyping", "Kleinserienfertigung"],
      priceRange: "CHF 5 – CHF 500",
      currenciesAccepted: "CHF",
      paymentAccepted: "Kreditkarte, TWINT, Banküberweisung",
      openingHours: "Mo-Fr 08:00-18:00",
      sameAs: ["https://www.instagram.com/3dmuscio", "https://www.linkedin.com/company/3dmuscio"],
      makesOffer: [
        { "@type": "Offer", itemOffered: { "@type": "Service", name: "FDM 3D Druck" } },
        { "@type": "Offer", itemOffered: { "@type": "Service", name: "SLA Resin Druck" } },
        { "@type": "Offer", itemOffered: { "@type": "Service", name: "Prototypenentwicklung" } },
        { "@type": "Offer", itemOffered: { "@type": "Service", name: "Kleinserienfertigung" } },
        { "@type": "Offer", itemOffered: { "@type": "Service", name: "Ersatzteile herstellen" } },
      ],
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "3D Druckleistungen und Materialien",
        itemListElement: [
          {
            "@type": "OfferCatalog",
            name: "Verfahren",
            itemListElement: [
              {
                "@type": "Offer",
                itemOffered: { "@type": "Service", name: "FDM 3D Druck", serviceType: "FDM" },
              },
              {
                "@type": "Offer",
                itemOffered: { "@type": "Service", name: "SLA Resin Druck", serviceType: "SLA" },
              },
            ],
          },
          {
            "@type": "OfferCatalog",
            name: "Materialien",
            itemListElement: [
              { "@type": "Offer", itemOffered: { "@type": "Service", name: "3D-Druck in PLA", serviceType: "3D-Druck" } },
              { "@type": "Offer", itemOffered: { "@type": "Service", name: "3D-Druck in PETG", serviceType: "3D-Druck" } },
              { "@type": "Offer", itemOffered: { "@type": "Service", name: "3D-Druck in ABS", serviceType: "3D-Druck" } },
              { "@type": "Offer", itemOffered: { "@type": "Service", name: "3D-Druck in ASA", serviceType: "3D-Druck" } },
              { "@type": "Offer", itemOffered: { "@type": "Service", name: "3D-Druck in TPU", serviceType: "3D-Druck" } },
              { "@type": "Offer", itemOffered: { "@type": "Service", name: "3D-Druck in Nylon (PA)", serviceType: "3D-Druck" } },
              { "@type": "Offer", itemOffered: { "@type": "Service", name: "3D-Druck in Resin", serviceType: "3D-Druck" } },
            ],
          },
        ],
      },
    },
    {
      "@type": "Service",
      name: "3D Druckservice Schweiz",
      provider: { "@id": "https://3dmuscio.com/#organization" },
      serviceType: "3D Druck",
      description:
        "FDM und SLA 3D Druckservice für B2B-Kunden in der Schweiz. Materialien: PLA, PETG, ABS, ASA, TPU, Nylon, Resin.",
      areaServed: { "@type": "Country", name: "Schweiz" },
      url: "https://3dmuscio.com",
    },
    {
      "@type": "WebSite",
      "@id": "https://3dmuscio.com/#website",
      url: "https://3dmuscio.com",
      name: "3DMuscio",
      inLanguage: "de-CH",
      publisher: { "@id": "https://3dmuscio.com/#organization" },
    },
  ],
});

export const organizationJsonLd = JSON.stringify(buildOrganizationJsonLd());
