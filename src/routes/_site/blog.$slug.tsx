import { createFileRoute } from "@tanstack/react-router";
import BlogPostPage from "@/pages/site/BlogPostPage";

export const Route = createFileRoute("/_site/blog/$slug")({
  component: BlogPostPage,
});
