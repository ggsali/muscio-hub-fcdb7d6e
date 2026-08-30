import { createFileRoute } from "@tanstack/react-router";
import PlattenPlanerPage from "@/pages/PlattenPlanerPage";

export const Route = createFileRoute("/admin/auftraege/$id/platten")({
  component: PlattenPlanerPage,
});
