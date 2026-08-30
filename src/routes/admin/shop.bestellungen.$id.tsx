import { createFileRoute } from "@tanstack/react-router";
import ShopBestellungDetailPage from "@/pages/ShopBestellungDetailPage";

export const Route = createFileRoute("/admin/shop/bestellungen/$id")({
  component: ShopBestellungDetailPage,
});
