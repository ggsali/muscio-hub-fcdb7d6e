import { createFileRoute } from "@tanstack/react-router";
import FilamentePage from "@/pages/FilamentePage";

export const Route = createFileRoute("/admin/filamente")({
  component: FilamentePage,
});
