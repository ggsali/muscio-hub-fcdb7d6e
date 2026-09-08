import { createFileRoute } from "@tanstack/react-router";
import ScanPage from "@/pages/ScanPage";

export const Route = createFileRoute("/admin/scan")({
  component: ScanPage,
});
