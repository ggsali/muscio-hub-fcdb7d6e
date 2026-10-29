import { createFileRoute } from "@tanstack/react-router";
import ZeiterfassungPage from "@/pages/ZeiterfassungPage";

export const Route = createFileRoute("/admin/zeiterfassung")({
  component: ZeiterfassungPage,
});
