import { createFileRoute } from "@tanstack/react-router";
import GravurPage from "@/pages/GravurPage";

export const Route = createFileRoute("/admin/gravur")({
  component: GravurPage,
});
