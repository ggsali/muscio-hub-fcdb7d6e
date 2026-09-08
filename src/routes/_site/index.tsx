import { createFileRoute } from "@tanstack/react-router";
import HomePage from "@/pages/site/HomePage";
import { buildHead } from "@/lib/seo-head";

export const Route = createFileRoute("/_site/")({
  component: HomePage,
  head: () =>
    buildHead({
      title: "3D-Druckservice Schweiz – FDM & SLA ab 1 Stück | 3DMuscio",
      description:
        "Schweizer 3D-Druckservice aus Eschlikon TG: FDM und SLA/Resin aus einer Hand, ab 1 Stück, Sofortpreis im Kalkulator, Produktion in 48 h versandbereit.",
      path: "/",
    }),
});
