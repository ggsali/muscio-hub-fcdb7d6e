import { createFileRoute } from "@tanstack/react-router";
import AbrechnungenPage from "@/pages/AbrechnungenPage";

export const Route = createFileRoute("/admin/finanzen/abrechnungen/")({
  component: AbrechnungenPage,
});
