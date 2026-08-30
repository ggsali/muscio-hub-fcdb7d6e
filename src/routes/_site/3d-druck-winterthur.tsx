import { createFileRoute } from "@tanstack/react-router";
import LokalPage from "@/pages/site/LokalPage";

export const Route = createFileRoute("/_site/3d-druck-winterthur")({
  component: LokalPage,
});
