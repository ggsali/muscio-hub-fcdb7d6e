import { createFileRoute } from "@tanstack/react-router";
import AbrechnungDetailPage from "@/pages/AbrechnungDetailPage";

export const Route = createFileRoute("/admin/finanzen/abrechnungen/$id")({
  component: AbrechnungDetailPage,
});
