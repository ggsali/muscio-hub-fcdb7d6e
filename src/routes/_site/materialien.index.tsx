import { createFileRoute } from "@tanstack/react-router";
import MaterialienPage from "@/pages/site/MaterialienPage";

export const Route = createFileRoute("/_site/materialien/")({
  component: MaterialienPage,
});
