import { createFileRoute } from "@tanstack/react-router";
import WebsiteEinstellungenPage from "@/pages/WebsiteEinstellungenPage";

export const Route = createFileRoute("/admin/website/einstellungen")({
  component: WebsiteEinstellungenPage,
});
