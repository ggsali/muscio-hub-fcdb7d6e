import { createFileRoute } from "@tanstack/react-router";
import TimelineAdminPage from "@/pages/website-admin/TimelineAdminPage";

export const Route = createFileRoute("/website-admin/timeline")({
  component: TimelineAdminPage,
});
