import { createFileRoute } from "@tanstack/react-router";
import FaqPage from "@/pages/site/FaqPage";
import { buildHead } from "@/lib/seo-head";

export const Route = createFileRoute("/_site/faq")({
  component: FaqPage,
  head: () =>
    buildHead({
      title: "FAQ – Häufige Fragen zum 3D-Druck | 3DMuscio",
      description:
        "Antworten auf häufige Fragen zu Lieferzeit, Dateiformaten, Genauigkeit, Materialien und Preisen im 3D-Druck bei 3DMuscio in Eschlikon TG.",
      path: "/faq",
    }),
});
