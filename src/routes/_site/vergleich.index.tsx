import { createFileRoute } from "@tanstack/react-router";
import VergleichPage from "@/pages/site/VergleichPage";
import { buildHead } from "@/lib/seo-head";

export const Route = createFileRoute("/_site/vergleich/")({
  head: ({ matches }) => buildHead({ title: "3D-Druck Vergleiche: Materialien & Verfahren | 3DMuscio", description: "PLA vs PETG, PETG vs ABS, ABS vs ASA, FDM vs SLA, 3D-Druck vs CNC und Spritzguss im direkten Vergleich.", path: "/vergleich" }, matches.at(-1)?.context.resinEnabled ?? false),
  component: VergleichPage,
});
