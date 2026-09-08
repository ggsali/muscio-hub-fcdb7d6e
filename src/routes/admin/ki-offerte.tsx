import { createFileRoute } from "@tanstack/react-router";
import KiOffertePage from "@/pages/KiOffertePage";

export const Route = createFileRoute("/admin/ki-offerte")({
  component: KiOffertePage,
});
