import { createFileRoute } from "@tanstack/react-router";
import SiteLayout from "@/components/SiteLayout";
import MaintenanceGate from "@/components/MaintenanceGate";
import { getPublicResinEnabled } from "@/lib/resin.functions";
import { ResinEnabledContext } from "@/hooks/useResinEnabled";

export const Route = createFileRoute("/_site")({
  beforeLoad: async () => ({ resinEnabled: await getPublicResinEnabled() }),
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
