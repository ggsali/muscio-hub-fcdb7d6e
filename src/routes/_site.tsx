import { createFileRoute } from "@tanstack/react-router";
import SiteLayout from "@/components/SiteLayout";
import MaintenanceGate from "@/components/MaintenanceGate";

export const Route = createFileRoute("/_site")({
  component: () => (
    <MaintenanceGate>
      <SiteLayout />
    </MaintenanceGate>
  ),
});
