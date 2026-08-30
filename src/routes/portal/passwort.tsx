import { createFileRoute } from "@tanstack/react-router";
import PortalPasswordPage from "@/pages/portal/PortalPasswordPage";

export const Route = createFileRoute("/portal/passwort")({
  component: PortalPasswordPage,
});
