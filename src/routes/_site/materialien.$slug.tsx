import { createFileRoute, redirect } from "@tanstack/react-router";
import { isResinText } from "@/lib/resin-content";
import MaterialDetailPage from "@/pages/site/MaterialDetailPage";
import { materials } from "@/data/seo/materials";
import { buildHead } from "@/lib/seo-head";

export const Route = createFileRoute("/_site/materialien/$slug")({
  beforeLoad: ({ context, params }) => {
    if (!context.resinEnabled && isResinText(params.slug)) throw redirect({ to: "/materialien" });
  },
  component: MaterialDetailPage,
  head: ({ params, matches }) => {
    const material = materials.find((m) => m.slug === params.slug);
    if (!material) return {};
    return buildHead({
      title: material.title,
      description: material.description,
      path: `/materialien/${material.slug}`,
    }, matches.at(-1)?.context.resinEnabled ?? false);
  },
});
