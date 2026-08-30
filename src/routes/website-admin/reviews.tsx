import { createFileRoute } from "@tanstack/react-router";
import ReviewsAdminPage from "@/pages/website-admin/ReviewsAdminPage";

export const Route = createFileRoute("/website-admin/reviews")({
  component: ReviewsAdminPage,
});
