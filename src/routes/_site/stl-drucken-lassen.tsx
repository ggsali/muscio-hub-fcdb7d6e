import { createFileRoute } from "@tanstack/react-router";
import StlDruckenPage from "@/pages/site/StlDruckenPage";
import { buildHead } from "@/lib/seo-head";

export const Route = createFileRoute("/_site/stl-drucken-lassen")({
  component: StlDruckenPage,
  head: ({ matches }) => buildHead({
    title: "STL drucken lassen Schweiz – ab CHF 5 | 3DMuscio",
    description: "STL-Datei hochladen, Sofortpreis sehen und in 48 h versandbereit. 3D-Druck ab 1 Stück für Privat und Firmen, Versand in die Schweiz und nach Liechtenstein.",
    path: "/stl-drucken-lassen",
  }, matches.at(-1)?.context.resinEnabled ?? false),
});
