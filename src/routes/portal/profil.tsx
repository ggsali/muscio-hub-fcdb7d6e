import { createFileRoute } from "@tanstack/react-router";
import PortalProfilePage from "@/pages/portal/PortalProfilePage";

export const Route = createFileRoute("/portal/profil")({
  component: PortalProfilePage,
});
