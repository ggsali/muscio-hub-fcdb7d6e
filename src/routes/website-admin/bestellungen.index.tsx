import { createFileRoute } from "@tanstack/react-router";
import WebsiteBestellungenPage from "@/pages/WebsiteBestellungenPage";

export const Route = createFileRoute("/website-admin/bestellungen/")({
  component: WebsiteBestellungenPage,
});
