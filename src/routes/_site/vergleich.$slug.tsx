import { createFileRoute, redirect } from "@tanstack/react-router";
import { isResinText } from "@/lib/resin-content";
import { getComparison } from "@/data/seo/comparisons";
import { buildHead } from "@/lib/seo-head";
import VergleichPage from "@/pages/site/VergleichPage";

export const Route = createFileRoute("/_site/vergleich/$slug")({
  beforeLoad: ({ context, params }) => {
    if (!context.resinEnabled && isResinText(params.slug)) throw redirect({ to: "/vergleich" });
  },
  head: ({ params, matches }) => {
    const comparison = getComparison(params.slug);
    return buildHead({ title: comparison?.title ?? "3D-Druck Vergleich | 3DMuscio", description: comparison?.description ?? "Materialien und Verfahren für 3D-Druck im Vergleich.", path: `/vergleich/${params.slug}` }, matches.at(-1)?.context.resinEnabled ?? false);
  },
  component: VergleichPage,
});
