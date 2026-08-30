import { createFileRoute } from "@tanstack/react-router";
import ProjekteAdminPage from "@/pages/website-admin/ProjekteAdminPage";

export const Route = createFileRoute("/website-admin/projekte")({
  component: ProjekteAdminPage,
});
