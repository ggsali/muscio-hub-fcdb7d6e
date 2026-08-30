import { createFileRoute } from "@tanstack/react-router";
import KostenPage from "@/pages/site/KostenPage";

export const Route = createFileRoute("/_site/wissen/3d-druck-kosten-schweiz")({
  component: KostenPage,
});
