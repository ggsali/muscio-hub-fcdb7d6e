import { createFileRoute } from "@tanstack/react-router";
import NewsletterAbmeldenPage from "@/pages/site/NewsletterAbmeldenPage";

export const Route = createFileRoute("/_site/newsletter/abmelden")({
  component: NewsletterAbmeldenPage,
});
