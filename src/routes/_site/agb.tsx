import { createFileRoute } from "@tanstack/react-router";
import AGBPage from "@/pages/site/AGBPage";

export const Route = createFileRoute("/_site/agb")({
  component: AGBPage,
});
