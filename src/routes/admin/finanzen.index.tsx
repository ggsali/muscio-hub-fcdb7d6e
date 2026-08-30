import { createFileRoute } from "@tanstack/react-router";
import FinanzenPage from "@/pages/FinanzenPage";

export const Route = createFileRoute("/admin/finanzen/")({
  component: FinanzenPage,
});
