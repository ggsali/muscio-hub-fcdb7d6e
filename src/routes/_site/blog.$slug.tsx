import { canonicalHead } from "@/lib/seo-head";
import { createFileRoute } from "@tanstack/react-router";
import BlogPostPage from "@/pages/site/BlogPostPage";

export const Route = createFileRoute("/_site/blog/$slug")({
  head: ({ params }) => canonicalHead(`/blog/${params.slug}`),
  component: BlogPostPage,
});
