import { createFileRoute } from "@tanstack/react-router";
import PortalDokumentePage from "@/pages/portal/PortalDokumentePage";

export const Route = createFileRoute("/portal/dokumente")({
  component: PortalDokumentePage,
});
