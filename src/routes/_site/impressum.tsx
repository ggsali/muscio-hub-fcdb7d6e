import { createFileRoute } from "@tanstack/react-router";
import ImpressumPage from "@/pages/site/ImpressumPage";

export const Route = createFileRoute("/_site/impressum")({
  component: ImpressumPage,
});
