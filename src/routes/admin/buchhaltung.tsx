import { createFileRoute } from "@tanstack/react-router";
import BuchhaltungPage from "@/pages/BuchhaltungPage";

export const Route = createFileRoute("/admin/buchhaltung")({
  component: BuchhaltungPage,
});
