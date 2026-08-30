import { createFileRoute } from "@tanstack/react-router";
import EinstellungenPage from "@/pages/EinstellungenPage";

export const Route = createFileRoute("/admin/einstellungen")({
  component: EinstellungenPage,
});
