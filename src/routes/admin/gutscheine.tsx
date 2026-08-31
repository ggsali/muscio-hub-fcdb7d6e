import { createFileRoute } from "@tanstack/react-router";
import GutscheinePage from "@/pages/GutscheinePage";

export const Route = createFileRoute("/admin/gutscheine")({
  component: GutscheinePage,
});
