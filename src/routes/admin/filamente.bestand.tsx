import { createFileRoute } from "@tanstack/react-router";
import FilamentBestandPage from "@/pages/filament/FilamentBestandPage";

export const Route = createFileRoute("/admin/filamente/bestand")({
  component: FilamentBestandPage,
});
