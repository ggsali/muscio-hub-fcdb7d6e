import { createFileRoute } from "@tanstack/react-router";
import LagerPage from "@/pages/LagerPage";

export const Route = createFileRoute("/admin/lager")({
  component: LagerPage,
});
