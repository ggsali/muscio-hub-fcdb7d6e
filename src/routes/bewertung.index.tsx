import { createFileRoute } from "@tanstack/react-router";
import BewertungPage from "@/pages/site/BewertungPage";

export const Route = createFileRoute("/bewertung/")({
  component: BewertungPage,
});
