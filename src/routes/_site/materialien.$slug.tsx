import { createFileRoute } from "@tanstack/react-router";
import MaterialDetailPage from "@/pages/site/MaterialDetailPage";
import { materials } from "@/data/seo/materials";
import { buildHead } from "@/lib/seo-head";

export const Route = createFileRoute("/_site/materialien/$slug")({
  component: MaterialDetailPage,
  head: ({ params }) => {
    const material = materials.find((m) => m.slug === params.slug);
    if (!material) return {};
    return buildHead({
      title: material.title,
      description: material.description,
      path: `/materialien/${material.slug}`,
    });
  },
});
