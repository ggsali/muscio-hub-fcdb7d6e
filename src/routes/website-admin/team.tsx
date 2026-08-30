import { createFileRoute } from "@tanstack/react-router";
import TeamAdminPage from "@/pages/website-admin/TeamAdminPage";

export const Route = createFileRoute("/website-admin/team")({
  component: TeamAdminPage,
});
