import { createFileRoute } from "@tanstack/react-router";
import ServiceDetailPage from "@/pages/site/ServiceDetailPage";
import { getService } from "@/data/seo/services";
import { buildHead } from "@/lib/seo-head";

export const Route = createFileRoute("/_site/leistungen/$slug")({
  component: ServiceDetailPage,
  head: ({ params }) => {
    const service = getService(params.slug);
    if (!service) return {};
    return buildHead({
      title: service.title,
      description: service.description,
      path: `/leistungen/${service.slug}`,
    });
  },
});
