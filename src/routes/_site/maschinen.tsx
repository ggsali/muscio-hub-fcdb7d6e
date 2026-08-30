import { createFileRoute } from "@tanstack/react-router";
import EquipmentPage from "@/pages/site/EquipmentPage";

export const Route = createFileRoute("/_site/maschinen")({
  component: EquipmentPage,
});
