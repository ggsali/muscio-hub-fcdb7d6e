import { createFileRoute } from "@tanstack/react-router";
import AuftragDetailPage from "@/pages/AuftragDetailPage";

export const Route = createFileRoute("/admin/auftraege/$id/")({
  component: AuftragDetailPage,
});
