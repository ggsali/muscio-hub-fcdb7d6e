import { canonicalHead } from "@/lib/seo-head";
import { createFileRoute } from "@tanstack/react-router";
import BlogPage from "@/pages/site/BlogPage";

export const Route = createFileRoute("/_site/blog/")({
  head: () => canonicalHead("/blog"),
  component: BlogPage,
});
