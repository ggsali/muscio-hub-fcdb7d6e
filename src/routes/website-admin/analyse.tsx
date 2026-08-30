import { createFileRoute } from "@tanstack/react-router";
import WebsiteAnalyticsPage from "@/pages/website-admin/WebsiteAnalyticsPage";

export const Route = createFileRoute("/website-admin/analyse")({
  component: WebsiteAnalyticsPage,
});
