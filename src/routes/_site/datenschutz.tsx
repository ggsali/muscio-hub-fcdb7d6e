import { createFileRoute } from "@tanstack/react-router";
import DatenschutzPage from "@/pages/site/DatenschutzPage";

export const Route = createFileRoute("/_site/datenschutz")({
  component: DatenschutzPage,
});
