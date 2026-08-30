import { createFileRoute } from "@tanstack/react-router";
import NewsletterPage from "@/pages/NewsletterPage";

export const Route = createFileRoute("/admin/newsletter")({
  component: NewsletterPage,
});
