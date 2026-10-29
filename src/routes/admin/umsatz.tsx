import { createFileRoute } from "@tanstack/react-router";
import UmsatzAnalysePage from "@/pages/UmsatzAnalysePage";

export const Route = createFileRoute("/admin/umsatz")({
  component: UmsatzAnalysePage,
});
