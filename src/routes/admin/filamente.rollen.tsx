import { createFileRoute } from "@tanstack/react-router";
import FilamentRollenPage from "@/pages/filament/FilamentRollenPage";

export const Route = createFileRoute("/admin/filamente/rollen")({
  component: FilamentRollenPage,
});
