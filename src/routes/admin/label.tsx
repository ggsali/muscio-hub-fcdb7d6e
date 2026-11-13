import { createFileRoute } from "@tanstack/react-router";
import LabelPage from "@/pages/LabelPage";

export const Route = createFileRoute("/admin/label")({
  component: LabelPage,
});
