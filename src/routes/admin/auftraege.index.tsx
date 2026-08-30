import { createFileRoute } from "@tanstack/react-router";
import AuftraegePage from "@/pages/AuftraegePage";

export const Route = createFileRoute("/admin/auftraege/")({
  component: AuftraegePage,
});
