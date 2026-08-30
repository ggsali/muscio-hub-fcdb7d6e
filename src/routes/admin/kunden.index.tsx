import { createFileRoute } from "@tanstack/react-router";
import KundenPage from "@/pages/KundenPage";

export const Route = createFileRoute("/admin/kunden/")({
  component: KundenPage,
});
