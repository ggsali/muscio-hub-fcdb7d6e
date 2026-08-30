import { createFileRoute } from "@tanstack/react-router";
import BlogAdminPage from "@/pages/website-admin/BlogAdminPage";

export const Route = createFileRoute("/website-admin/blog")({
  component: BlogAdminPage,
});
