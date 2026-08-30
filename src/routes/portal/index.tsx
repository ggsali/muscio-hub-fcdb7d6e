import { createFileRoute } from "@tanstack/react-router";
import PortalDashboardPage from "@/pages/portal/PortalDashboardPage";

export const Route = createFileRoute("/portal/")({
  component: PortalDashboardPage,
});
