import { createFileRoute } from "@tanstack/react-router";
import EquipmentAdminPage from "@/pages/website-admin/EquipmentAdminPage";

export const Route = createFileRoute("/website-admin/equipment")({
  component: EquipmentAdminPage,
});
