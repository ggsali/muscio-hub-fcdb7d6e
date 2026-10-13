import { createFileRoute } from "@tanstack/react-router";
import FilamentVerbrauchPage from "@/pages/filament/FilamentVerbrauchPage";

export const Route = createFileRoute("/admin/filamentverbrauch")({
  component: FilamentVerbrauchPage,
});
