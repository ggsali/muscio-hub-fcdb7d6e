import { createFileRoute } from "@tanstack/react-router";
import LaborIndexPage from "@/pages/LaborIndexPage";

export const Route = createFileRoute("/labor/")({
  component: LaborIndexPage,
});
