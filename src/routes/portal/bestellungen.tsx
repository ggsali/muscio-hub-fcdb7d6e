import { createFileRoute } from "@tanstack/react-router";
import PortalOrdersPage from "@/pages/portal/PortalOrdersPage";

export const Route = createFileRoute("/portal/bestellungen")({
  component: PortalOrdersPage,
});
