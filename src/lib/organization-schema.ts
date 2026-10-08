// Ported from index.html: LocalBusiness / ManufacturingBusiness + Service + WebSite Schema
export const organizationJsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": ["LocalBusiness", "ProfessionalService", "ManufacturingBusiness"],
      "@id": "https://3dmuscio.com/#organization",
      name: "3DMuscio",
      description:
        "Schweizer 3D-Druckservice für Prototypen, Ersatzteile und Kleinserien. FDM und SLA 3D-Druck aus Eschlikon TG.",
      url: "https://3dmuscio.com",
      email: "info@3dmuscio.com",
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
      areaServed: { "@type": "Country", name: "Schweiz" },
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
              { "@type": "Offer", itemOffered: { "@type": "Product", name: "PLA", material: "PLA" } },
              { "@type": "Offer", itemOffered: { "@type": "Product", name: "PETG", material: "PETG" } },
              { "@type": "Offer", itemOffered: { "@type": "Product", name: "ABS", material: "ABS" } },
              { "@type": "Offer", itemOffered: { "@type": "Product", name: "ASA", material: "ASA" } },
              { "@type": "Offer", itemOffered: { "@type": "Product", name: "TPU", material: "TPU" } },
              {
                "@type": "Offer",
                itemOffered: { "@type": "Product", name: "Nylon (PA)", material: "Nylon" },
              },
              {
                "@type": "Offer",
                itemOffered: { "@type": "Product", name: "Resin", material: "Resin" },
              },
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

