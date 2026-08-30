import { createFileRoute } from "@tanstack/react-router";
import WebsiteKundenAdminPage from "@/pages/WebsiteKundenAdminPage";

export const Route = createFileRoute("/website-admin/kunden")({
  component: WebsiteKundenAdminPage,
});
