import { createFileRoute } from "@tanstack/react-router";
import DruckplattenPage from "@/pages/DruckplattenPage";

export const Route = createFileRoute("/admin/druckplatten")({
  component: DruckplattenPage,
});
