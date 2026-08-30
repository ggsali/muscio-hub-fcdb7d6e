import { createFileRoute } from "@tanstack/react-router";
import WebsiteAdminDashboardPage from "@/pages/website-admin/WebsiteAdminDashboardPage";

export const Route = createFileRoute("/website-admin/")({
  component: WebsiteAdminDashboardPage,
});
