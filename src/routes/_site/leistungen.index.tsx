import { createFileRoute } from "@tanstack/react-router";
import LeistungenPage from "@/pages/site/LeistungenPage";

export const Route = createFileRoute("/_site/leistungen/")({
  component: LeistungenPage,
});
