import { createFileRoute } from "@tanstack/react-router";
import DruckSchweizPage from "@/pages/site/DruckSchweizPage";

export const Route = createFileRoute("/_site/3d-druck-schweiz")({
  component: DruckSchweizPage,
});
