import { createFileRoute } from "@tanstack/react-router";
import CalculatorOnlinePage from "@/pages/site/CalculatorOnlinePage";

export const Route = createFileRoute("/_site/kalkulator-online")({
  component: CalculatorOnlinePage,
});
