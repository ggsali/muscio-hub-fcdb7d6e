import { createFileRoute } from "@tanstack/react-router";
import KalkulatorTestPage from "@/pages/KalkulatorTestPage";

export const Route = createFileRoute("/labor/kalkulator")({
  component: KalkulatorTestPage,
});
