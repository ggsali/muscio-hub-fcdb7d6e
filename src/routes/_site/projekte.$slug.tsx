import { createFileRoute } from "@tanstack/react-router";
import ProjektDetailPage from "@/pages/site/ProjektDetailPage";

export const Route = createFileRoute("/_site/projekte/$slug")({
  component: ProjektDetailPage,
});
