import { createFileRoute } from "@tanstack/react-router";
import ShopUebersichtAdminPage from "@/pages/website-admin/ShopUebersichtAdminPage";

export const Route = createFileRoute("/website-admin/shop")({
  component: ShopUebersichtAdminPage,
});
