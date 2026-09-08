import { createFileRoute } from "@tanstack/react-router";
import LeistungenPage from "@/pages/site/LeistungenPage";
import { buildHead } from "@/lib/seo-head";

export const Route = createFileRoute("/_site/leistungen/")({
  component: LeistungenPage,
  head: () =>
    buildHead({
      title: "Leistungen – FDM & SLA 3D-Druck, Prototypen, Kleinserien | 3DMuscio",
      description:
        "Alle Leistungen von 3DMuscio: FDM und SLA/Resin 3D-Druck, Rapid Prototyping, Kleinserien, Ersatzteile und B2B – gefertigt in Eschlikon TG für die ganze Schweiz.",
      path: "/leistungen",
    }),
});
