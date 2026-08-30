import { createFileRoute } from "@tanstack/react-router";
import NeueRechnungPage from "@/pages/NeueRechnungPage";

export const Route = createFileRoute("/admin/finanzen/neue-rechnung")({
  component: NeueRechnungPage,
});
