import { createFileRoute } from "@tanstack/react-router";
import CalculatorOnlinePage from "@/pages/site/CalculatorOnlinePage";
import { buildHead } from "@/lib/seo-head";

export const Route = createFileRoute("/_site/kalkulator-online")({
  component: CalculatorOnlinePage,
  head: () =>
    buildHead({
      title: "3D-Druck Kosten berechnen – Sofortpreis online | 3DMuscio",
      description:
        "Berechne deinen 3D-Druckauftrag sofort und kostenlos: Datei hochladen, Material wählen, Preis in Sekunden sehen. FDM & SLA aus der Schweiz, ab 1 Stück.",
      path: "/kalkulator-online",
    }),
});
