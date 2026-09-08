import { createFileRoute } from "@tanstack/react-router";
import DruckSchweizPage from "@/pages/site/DruckSchweizPage";
import { buildHead } from "@/lib/seo-head";

export const Route = createFileRoute("/_site/3d-druck-schweiz")({
  component: DruckSchweizPage,
  head: () =>
    buildHead({
      title: "3D-Druck Schweiz – FDM & SLA Druckservice ab 1 Stück | 3DMuscio",
      description:
        "3D-Druckservice aus der Schweiz: FDM und SLA/Resin aus einer Hand, ab 1 Stück, Sofortpreis im Kalkulator, Produktion in Eschlikon TG, Versand schweizweit.",
      path: "/3d-druck-schweiz",
    }),
});
