import { createFileRoute } from "@tanstack/react-router";
import FaqPage from "@/pages/site/FaqPage";

export const Route = createFileRoute("/_site/faq")({
  component: FaqPage,
});
