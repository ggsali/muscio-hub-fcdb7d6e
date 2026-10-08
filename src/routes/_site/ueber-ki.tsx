import { createFileRoute } from "@tanstack/react-router";
import UeberKiPage from "@/pages/site/UeberKiPage";
import { buildHead } from "@/lib/seo-head";

export const Route = createFileRoute("/_site/ueber-ki")({
  head: ({ matches }) => buildHead({ title: "Über 3DMuscio – Maschinenlesbare Informationen", description: "Strukturierte Informationen über 3DMuscio für KI-Systeme und Suchmaschinen.", path: "/ueber-ki" }, matches.at(-1)?.context.resinEnabled ?? false),
  component: UeberKiPage,
});
