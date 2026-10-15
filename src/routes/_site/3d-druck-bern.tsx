import { createFileRoute } from "@tanstack/react-router";
import LokalPage from "@/pages/site/LokalPage";
import { reviewLoader } from "@/hooks/useReviewData";

export const Route = createFileRoute("/_site/3d-druck-bern")({
  loader: reviewLoader,
  component: LokalPage,
});
