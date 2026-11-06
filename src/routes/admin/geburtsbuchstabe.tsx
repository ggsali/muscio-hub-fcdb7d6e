import { createFileRoute } from "@tanstack/react-router";
import GeburtsBuchstabePage from "@/pages/GeburtsBuchstabePage";

export const Route = createFileRoute("/admin/geburtsbuchstabe")({
  component: GeburtsBuchstabePage,
});
