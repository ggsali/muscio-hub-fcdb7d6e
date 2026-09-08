import { createFileRoute } from "@tanstack/react-router";
import UeberUnsPage from "@/pages/site/UeberUnsPage";
import { buildHead } from "@/lib/seo-head";

export const Route = createFileRoute("/_site/ueber-uns")({
  component: UeberUnsPage,
  head: () =>
    buildHead({
      title: "Über uns – 3DMuscio, dein 3D-Druck Partner in der Schweiz",
      description:
        "3DMuscio aus Eschlikon TG: Geschichte, Team und Standort. Partner für FDM- und SLA-3D-Druck, Prototypen, Kleinserien und Ersatzteile in der ganzen Schweiz.",
      path: "/ueber-uns",
    }),
});
