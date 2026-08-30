import { createFileRoute } from "@tanstack/react-router";
import ShopProdukteAdminPage from "@/pages/website-admin/ShopProdukteAdminPage";

export const Route = createFileRoute("/website-admin/shop-produkte")({
  component: ShopProdukteAdminPage,
});
