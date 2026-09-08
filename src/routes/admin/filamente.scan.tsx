import { createFileRoute } from "@tanstack/react-router";
import FilamentScanPage from "@/pages/filament/FilamentScanPage";

export const Route = createFileRoute("/admin/filamente/scan")({
  component: FilamentScanPage,
});
