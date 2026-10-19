import { createFileRoute } from "@tanstack/react-router";
import SliceFreigabePage from "@/pages/SliceFreigabePage";

export const Route = createFileRoute("/admin/slice-freigabe")({
  component: SliceFreigabePage,
});
