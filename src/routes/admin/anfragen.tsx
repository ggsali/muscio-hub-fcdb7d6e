import { createFileRoute } from "@tanstack/react-router";
import AnfragenPage from "@/pages/AnfragenPage";

export const Route = createFileRoute("/admin/anfragen")({
  component: AnfragenPage,
});
