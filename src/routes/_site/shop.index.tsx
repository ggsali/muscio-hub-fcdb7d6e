import { createFileRoute } from "@tanstack/react-router";
import ShopPage from "@/pages/site/ShopPage";

export const Route = createFileRoute("/_site/shop/")({
  component: ShopPage,
});
