import { createFileRoute } from "@tanstack/react-router";
import WebsiteBestellungenPage from "@/pages/WebsiteBestellungenPage";

export const Route = createFileRoute("/admin/website/bestellungen")({
  component: WebsiteBestellungenPage,
});
