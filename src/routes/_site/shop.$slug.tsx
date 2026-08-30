import { createFileRoute } from "@tanstack/react-router";
import ShopDetailPage from "@/pages/site/ShopDetailPage";

export const Route = createFileRoute("/_site/shop/$slug")({
  component: ShopDetailPage,
});
