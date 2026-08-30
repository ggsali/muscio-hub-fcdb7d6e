import { createFileRoute } from "@tanstack/react-router";
import VergleichPage from "@/pages/site/VergleichPage";

export const Route = createFileRoute("/_site/vergleich/")({
  component: VergleichPage,
});
