import { createFileRoute } from "@tanstack/react-router";
import KundeDetailPage from "@/pages/KundeDetailPage";

export const Route = createFileRoute("/admin/kunden/$id")({
  component: KundeDetailPage,
});
