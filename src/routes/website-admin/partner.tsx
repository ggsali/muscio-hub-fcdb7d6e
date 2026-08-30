import { createFileRoute } from "@tanstack/react-router";
import PartnersAdminPage from "@/pages/website-admin/PartnersAdminPage";

export const Route = createFileRoute("/website-admin/partner")({
  component: PartnersAdminPage,
});
