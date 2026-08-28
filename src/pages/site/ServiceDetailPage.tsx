import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import Seo from "@/components/site/Seo";
import AnswerLanding from "@/components/site/AnswerLanding";
import DbContentPage, { type DbFaq } from "@/components/site/DbContentPage";
import { getService } from "@/data/seo/services";
import { supabase } from "@/integrations/supabase/client";
import { breadcrumbJsonLd, faqJsonLd, serviceJsonLd } from "@/data/company";

interface LeistungSeite {
  slug: string;
  titel: string;
  meta_title: string | null;
  meta_description: string | null;
  h1: string | null;
  intro: string | null;
  inhalt: string | null;
  faq: DbFaq[] | null;
}

const relatedMaterials = [
  { label: "PLA", to: "/materialien/pla", text: "Günstig, formstabil, für Modelle." },
  { label: "PETG", to: "/materialien/petg", text: "Der Allrounder für Funktionsteile." },
  { label: "ABS", to: "/materialien/abs", text: "Hitzebeständig und schlagfest." },
  { label: "ASA", to: "/materialien/asa", text: "UV-beständig für den Aussenbereich." },
  { label: "TPU", to: "/materialien/tpu", text: "Flexibel und schlagabsorbierend." },
];

export default function ServiceDetailPage() {
  const { slug } = useParams();
  const service = getService(slug);
  const [seite, setSeite] = useState<LeistungSeite | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSeite(null);
    (supabase.from("leistungen_seiten" as never) as any)
      .select("*")
      .eq("slug", slug)
      .eq("aktiv", true)
      .maybeSingle()
      .then(({ data }: { data: LeistungSeite | null }) => {
        if (cancelled) return;
        setSeite(data ?? null);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [slug]);

  if (!service && !seite && loading) {
    return <div className="container mx-auto px-4 py-20 text-sm text-muted-foreground">Lädt…</div>;
  }
  if (!service && !seite) return <Navigate to="/leistungen" replace />;

  const path = `/leistungen/${slug}`;

  if (seite) {
    const faqs = Array.isArray(seite.faq) ? seite.faq : [];
    const h1 = seite.h1 || seite.titel;
    const title = seite.meta_title || `${seite.titel} | 3DMuscio`;
    const description = seite.meta_description || seite.intro || "";
    const related = [
      ...(slug === "fdm-3d-druck" ? relatedMaterials : []),
      ...(service?.related ?? []).filter(r => !relatedMaterials.some(m => m.to === r.to)),
    ];

    return (
      <>
        <Seo
          title={title}
          description={description}
          path={path}
          jsonLd={[
            serviceJsonLd(h1, description, path),
            breadcrumbJsonLd([
              { name: "Start", path: "/" },
              { name: "Leistungen", path: "/leistungen" },
              { name: seite.titel, path },
            ]),
            ...(faqs.length ? [faqJsonLd(faqs.map(f => ({ q: f.frage, a: f.antwort })))] : []),
          ]}
        />
        <DbContentPage
          eyebrow="Leistung"
          h1={h1}
          intro={seite.intro}
          inhalt={seite.inhalt}
          faq={faqs}
          breadcrumb={[
            { name: "Start", to: "/" },
            { name: "Leistungen", to: "/leistungen" },
            { name: seite.titel, to: path },
          ]}
          related={related}
          ctaTitle={`${seite.titel} anfragen`}
        />
      </>
    );
  }

  if (!service) return <Navigate to="/leistungen" replace />;

  return (
    <>
      <Seo
        title={service.title}
        description={service.description}
        path={path}
        jsonLd={[
          serviceJsonLd(service.h1, service.description, path),
          breadcrumbJsonLd([
            { name: "Start", path: "/" },
            { name: "Leistungen", path: "/leistungen" },
            { name: service.h1, path },
          ]),
          faqJsonLd(service.faqs),
        ]}
      />
      <AnswerLanding
        eyebrow={service.eyebrow}
        h1={service.h1}
        shortAnswer={service.shortAnswer}
        breadcrumb={[
          { name: "Start", to: "/" },
          { name: "Leistungen", to: "/leistungen" },
          { name: service.h1, to: path },
        ]}
        sections={service.sections}
        faqs={service.faqs}
        related={service.related}
      />
    </>
  );
}
