import { createFileRoute } from "@tanstack/react-router";
import KalkulatorPage from "@/pages/KalkulatorPage";

export const Route = createFileRoute("/admin/kalkulator")({
  component: KalkulatorPage,
});
