import { createFileRoute } from "@tanstack/react-router";
import WebsiteEinstellungenPage from "@/pages/WebsiteEinstellungenPage";

export const Route = createFileRoute("/website-admin/einstellungen")({
  component: WebsiteEinstellungenPage,
});
