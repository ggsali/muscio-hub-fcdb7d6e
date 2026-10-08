import { createFileRoute } from "@tanstack/react-router";
import SiteLayout from "@/components/SiteLayout";
import MaintenanceGate from "@/components/MaintenanceGate";
import { getPublicResinEnabled } from "@/lib/resin.functions";
import { ResinEnabledContext } from "@/hooks/useResinEnabled";
import { organizationJsonLd } from "@/routes/__root";
import { filterResinData } from "@/lib/resin-content";

export const Route = createFileRoute("/_site")({
  beforeLoad: async () => ({ resinEnabled: await getPublicResinEnabled() }),
  head: ({ matches }) => ({ scripts: [{
    type: "application/ld+json",
    children: matches.at(-1)?.context.resinEnabled ? organizationJsonLd : JSON.stringify(filterResinData(JSON.parse(organizationJsonLd))),
  }] }),
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
