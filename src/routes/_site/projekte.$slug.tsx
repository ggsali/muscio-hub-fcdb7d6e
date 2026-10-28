import { canonicalHead } from "@/lib/seo-head";
import { createFileRoute } from "@tanstack/react-router";
import ProjektDetailPage from "@/pages/site/ProjektDetailPage";

export const Route = createFileRoute("/_site/projekte/$slug")({
  head: ({ params }) => canonicalHead(`/projekte/${params.slug}`),
  component: ProjektDetailPage,
});
