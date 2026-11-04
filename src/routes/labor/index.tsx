import { createFileRoute } from "@tanstack/react-router";
import LaborUebersichtPage from "@/pages/LaborUebersichtPage";

export const Route = createFileRoute("/labor/")({
  component: LaborUebersichtPage,
});
