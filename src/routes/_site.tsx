import { createFileRoute } from "@tanstack/react-router";
import SiteLayout from "@/components/SiteLayout";
import MaintenanceGate from "@/components/MaintenanceGate";
import { getPublicResinEnabled } from "@/lib/resin.functions";
import { ResinEnabledContext } from "@/hooks/useResinEnabled";
import { buildOrganizationJsonLd } from "@/lib/organization-schema";
import { buildRatingSchema } from "@/lib/review-schema";
import { filterResinData } from "@/lib/resin-content";

export const Route = createFileRoute("/_site")({
  beforeLoad: async ({ context }) => ({ resinEnabled: await context.queryClient.ensureQueryData({
    queryKey: ["public-resin-enabled"], queryFn: () => getPublicResinEnabled(), staleTime: 0,
  }) }),
  head: ({ matches }) => {
    const last = matches.at(-1) as any;
    // Bewertungen nur auf der Startseite (dort sichtbar im Seitentext); ein einziger LocalBusiness-Knoten.
    const rating = last?.pathname === "/" ? buildRatingSchema(last?.loaderData?.reviewData) : {};
    const graph = buildOrganizationJsonLd(rating);
    return { scripts: [{
      type: "application/ld+json",
      children: JSON.stringify(last?.context.resinEnabled ? graph : filterResinData(graph)),
    }] };
  },
  component: SiteRoute,
});

function SiteRoute() {
  const { resinEnabled } = Route.useRouteContext();
  return (
    <ResinEnabledContext.Provider value={resinEnabled}>
    <MaintenanceGate>
      <SiteLayout />
    </MaintenanceGate>
    </ResinEnabledContext.Provider>
  );
}
