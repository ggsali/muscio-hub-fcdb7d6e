import { createFileRoute } from "@tanstack/react-router";
import FilamentEtikettenPage from "@/pages/filament/FilamentEtikettenPage";

export const Route = createFileRoute("/admin/filamente/etiketten")({
  component: FilamentEtikettenPage,
});
