import { createFileRoute } from "@tanstack/react-router";
import NavigationAdminPage from "@/pages/website-admin/NavigationAdminPage";

export const Route = createFileRoute("/website-admin/navigation")({
  component: NavigationAdminPage,
});
