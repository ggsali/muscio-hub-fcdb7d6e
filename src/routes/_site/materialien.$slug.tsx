import { createFileRoute } from "@tanstack/react-router";
import MaterialDetailPage from "@/pages/site/MaterialDetailPage";

export const Route = createFileRoute("/_site/materialien/$slug")({
  component: MaterialDetailPage,
});
