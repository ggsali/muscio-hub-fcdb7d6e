import { createFileRoute } from "@tanstack/react-router";
import ContactPage from "@/pages/site/ContactPage";

export const Route = createFileRoute("/_site/kontakt")({
  component: ContactPage,
});
