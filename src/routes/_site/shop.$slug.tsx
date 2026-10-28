import { canonicalHead } from "@/lib/seo-head";
import { createFileRoute } from "@tanstack/react-router";
import ShopDetailPage from "@/pages/site/ShopDetailPage";

export const Route = createFileRoute("/_site/shop/$slug")({
  head: ({ params }) => canonicalHead(`/shop/${params.slug}`),
  component: ShopDetailPage,
});
