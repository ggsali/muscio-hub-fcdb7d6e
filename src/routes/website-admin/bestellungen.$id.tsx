import { createFileRoute } from "@tanstack/react-router";
import ShopBestellungDetailPage from "@/pages/ShopBestellungDetailPage";

export const Route = createFileRoute("/website-admin/bestellungen/$id")({
  component: ShopBestellungDetailPage,
});
