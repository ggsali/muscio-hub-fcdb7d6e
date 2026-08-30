import { useEffect, useState } from "react";
import { Navigate, useLocation } from "@/lib/router-compat";
import Seo from "@/components/site/Seo";
import DbContentPage, { type DbFaq } from "@/components/site/DbContentPage";
import { supabase } from "@/integrations/supabase/client";
import { breadcrumbJsonLd, company, faqJsonLd, SITE_URL } from "@/data/company";

interface LokaleSeite {
  slug: string;
  region_name: string;
  meta_title: string | null;
  meta_description: string | null;
}

/** Fallback, damit die Seite auch ohne Datenbank-Antwort rendert */
const FALLBACK: Record<string, string> = {
  "3d-druck-zuerich": "Zürich",
  "3d-druck-winterthur": "Winterthur",
  "3d-druck-st-gallen": "St. Gallen",
  "3d-druck-ostschweiz": "Ostschweiz",
  "3d-druck-bern": "Bern",
};

const inhalt = (region: string) => `## 3D-Druck für ${region}

3DMuscio ist ein 3D-Druckservice mit Standort in ${company.address.postalCode} ${company.address.city} ${company.address.regionCode}. Kunden aus ${region} laden ihre Datei online hoch, sehen den Preis sofort und erhalten die Teile per Post oder DHL – in der Regel innerhalb von 48 Stunden Produktionszeit plus 1–2 Tagen Versand.

## Verfahren und Materialien

- [FDM 3D-Druck](/leistungen/fdm-3d-druck) für belastbare Funktionsteile, Gehäuse und Halterungen
- [SLA Resin 3D-Druck](/leistungen/sla-3d-druck) für feine Details und glatte Oberflächen
- Materialien: [PLA](/materialien/pla), [PETG](/materialien/petg), [ABS](/materialien/abs), [ASA](/materialien/asa), [TPU](/materialien/tpu) und Resin

## Typische Aufträge aus ${region}

- [Prototypen](/leistungen/3d-druck-prototypen) für Produktentwicklung und Design
- [Ersatzteile](/leistungen/3d-druck-ersatzteile), die nicht mehr erhältlich sind
- [Kleinserien](/leistungen/3d-druck-kleinserien) ab 1 Stück, ohne Werkzeugkosten

## Ablauf

1. Datei (STL, STEP, 3MF, OBJ) im [Online-Kalkulator](/kalkulator-online) hochladen
2. Material, Farbe und Qualität wählen
3. Preis sofort sehen und bestellen
4. Produktion in ${company.address.city} – Versand nach ${region} oder Abholung nach Absprache

## Kontakt

${company.name}, ${company.address.street}, ${company.address.postalCode} ${company.address.city} ${company.address.regionCode} · ${company.email}`;

const faqFor = (region: string): DbFaq[] => [
  { frage: `Wie lange dauert die Lieferung nach ${region}?`, antwort: `Standard sind 48 Stunden Produktionszeit ab Auftragsbestätigung, danach 1–2 Tage Versand innerhalb der Schweiz.` },
  { frage: "Kann ich die Teile abholen?", antwort: `Ja, Abholung ist am Standort ${company.address.street}, ${company.address.postalCode} ${company.address.city} nach Absprache möglich.` },
  { frage: "Welche Dateiformate werden akzeptiert?", antwort: "STL, STEP, 3MF und OBJ – direkt im Online-Kalkulator hochladen." },
  { frage: "Gibt es eine Mindestbestellmenge?", antwort: "Nein, wir drucken ab 1 Stück. Ab 5 bzw. 10 Stück gibt es Mengenrabatt." },
];

export default function LokalPage() {
  const { pathname } = useLocation();
  const slug = pathname.replace(/^\//, "").replace(/\/$/, "");
  const [seite, setSeite] = useState<LokaleSeite | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (supabase.from("lokale_seiten" as never) as any)
      .select("*")
      .eq("slug", slug)
      .eq("aktiv", true)
      .maybeSingle()
      .then(({ data }: { data: LokaleSeite | null }) => {
        if (cancelled) return;
        setSeite(data ?? null);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [slug]);

  const fallbackRegion = FALLBACK[slug];
  if (!fallbackRegion && !seite) {
    return loading
      ? <div className="container mx-auto px-4 py-20 text-sm text-muted-foreground">Lädt…</div>
      : <Navigate to="/kontakt" replace />;
  }

  const region = seite?.region_name ?? fallbackRegion;
  const path = `/${slug}`;
  const title = seite?.meta_title ?? `3D-Druck ${region} – Lieferung in 48h | 3DMuscio`;
  const description =
    seite?.meta_description ??
    `3D-Druckservice für ${region}. FDM und SLA aus ${company.address.city} ${company.address.regionCode}, schweizweit geliefert in 48h.`;
  const faqs = faqFor(region);

  return (
    <>
      <Seo
        title={title}
        description={description}
        path={path}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "Service",
            name: `3D-Druckservice ${region}`,
            description,
            serviceType: "3D-Druck",
            url: `${SITE_URL}${path}`,
            provider: { "@id": `${SITE_URL}/#organization` },
            areaServed: { "@type": "AdministrativeArea", name: region },
          },
          breadcrumbJsonLd([
            { name: "Start", path: "/" },
            { name: `3D-Druck ${region}`, path },
          ]),
          faqJsonLd(faqs.map(f => ({ q: f.frage, a: f.antwort }))),
        ]}
      />
      <DbContentPage
        eyebrow={`Region ${region}`}
        h1={`3D-Druck ${region} – Prototypen, Ersatzteile und Kleinserien`}
        intro={`3D-Druckservice für ${region}: Datei online hochladen, Preis sofort sehen, Teile in 48 Stunden Produktionszeit erhalten. Gefertigt in ${company.address.postalCode} ${company.address.city} ${company.address.regionCode}.`}
        inhalt={inhalt(region)}
        faq={faqs}
        breadcrumb={[
          { name: "Start", to: "/" },
          { name: `3D-Druck ${region}`, to: path },
        ]}
        related={[
          { label: "Preis online berechnen", to: "/kalkulator-online", text: "Datei hochladen und Preis sehen." },
          { label: "FDM 3D-Druck", to: "/leistungen/fdm-3d-druck", text: "Belastbare Funktionsteile." },
          { label: "SLA Resin 3D-Druck", to: "/leistungen/sla-3d-druck", text: "Feine Details, glatte Oberflächen." },
          { label: "Materialien", to: "/materialien", text: "PLA, PETG, ABS, ASA, TPU, Resin." },
        ]}
        ctaTitle={`3D-Druck in ${region} anfragen`}
      />
    </>
  );
}
