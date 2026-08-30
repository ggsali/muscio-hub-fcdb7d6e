import { createFileRoute } from "@tanstack/react-router";
import StandortPage from "@/pages/site/StandortPage";

export const Route = createFileRoute("/_site/standorte/$slug")({
  component: StandortPage,
});
