import { createFileRoute } from "@tanstack/react-router";
import TeileBibliothekPage from "@/pages/TeileBibliothekPage";

export const Route = createFileRoute("/admin/teile")({
  component: TeileBibliothekPage,
});
