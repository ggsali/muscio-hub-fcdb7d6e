import { createFileRoute } from "@tanstack/react-router";
import BlogPage from "@/pages/site/BlogPage";

export const Route = createFileRoute("/_site/blog/")({
  component: BlogPage,
});
