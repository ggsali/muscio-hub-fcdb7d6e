import { createFileRoute } from "@tanstack/react-router";
import FilamentArtenPage from "@/pages/filament/FilamentArtenPage";

export const Route = createFileRoute("/admin/filamente/arten")({
  component: FilamentArtenPage,
});
