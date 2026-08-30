import { createFileRoute } from "@tanstack/react-router";
import HomePage from "@/pages/site/HomePage";

export const Route = createFileRoute("/_site/")({
  component: HomePage,
});
