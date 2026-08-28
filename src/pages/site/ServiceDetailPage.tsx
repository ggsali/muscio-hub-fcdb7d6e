import { Navigate, useParams } from "react-router-dom";
import Seo from "@/components/site/Seo";
import AnswerLanding from "@/components/site/AnswerLanding";
import { getService } from "@/data/seo/services";
import { breadcrumbJsonLd, faqJsonLd, serviceJsonLd } from "@/data/company";

export default function ServiceDetailPage() {
  const { slug } = useParams();
  const service = getService(slug);

  if (!service) return <Navigate to="/leistungen" replace />;

  const path = `/leistungen/${service.slug}`;

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
