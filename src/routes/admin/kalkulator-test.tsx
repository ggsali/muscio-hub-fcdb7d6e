import { createFileRoute } from "@tanstack/react-router";
import KalkulatorTestPage from "@/pages/KalkulatorTestPage";

export const Route = createFileRoute("/admin/kalkulator-test")({
  component: KalkulatorTestPage,
});
