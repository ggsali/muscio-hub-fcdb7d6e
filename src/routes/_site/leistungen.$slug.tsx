import { createFileRoute } from "@tanstack/react-router";
import ServiceDetailPage from "@/pages/site/ServiceDetailPage";

export const Route = createFileRoute("/_site/leistungen/$slug")({
  component: ServiceDetailPage,
});
