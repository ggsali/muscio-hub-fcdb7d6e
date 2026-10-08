import { createFileRoute, redirect } from "@tanstack/react-router";
import { isResinText } from "@/lib/resin-content";
import ServiceDetailPage from "@/pages/site/ServiceDetailPage";
import { getService } from "@/data/seo/services";
import { buildHead } from "@/lib/seo-head";

export const Route = createFileRoute("/_site/leistungen/$slug")({
  beforeLoad: ({ context, params }) => {
    if (!context.resinEnabled && isResinText(params.slug)) throw redirect({ to: "/leistungen" });
  },
  component: ServiceDetailPage,
  head: ({ params, matches }) => {
    const service = getService(params.slug);
    if (!service) return {};
    return buildHead({
      title: service.title,
      description: service.description,
      path: `/leistungen/${service.slug}`,
    }, matches.at(-1)?.context.resinEnabled ?? false);
  },
});
