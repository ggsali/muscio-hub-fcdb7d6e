import { createFileRoute } from "@tanstack/react-router";
import KalenderPage from "@/pages/KalenderPage";

export const Route = createFileRoute("/admin/kalender")({
  component: KalenderPage,
});
