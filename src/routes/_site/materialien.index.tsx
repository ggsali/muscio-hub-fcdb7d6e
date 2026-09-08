import { createFileRoute } from "@tanstack/react-router";
import MaterialienPage from "@/pages/site/MaterialienPage";
import { buildHead } from "@/lib/seo-head";

export const Route = createFileRoute("/_site/materialien/")({
  component: MaterialienPage,
  head: () =>
    buildHead({
      title: "Materialien für 3D-Druck – PLA, PETG, ABS, ASA, TPU, Resin | 3DMuscio",
      description:
        "Übersicht aller Materialien für deinen 3D-Druck: PLA, PETG, ABS, ASA, TPU und SLA-Resin mit Festigkeit, Temperatur- und UV-Beständigkeit sowie Einsatzgebieten.",
      path: "/materialien",
    }),
});
