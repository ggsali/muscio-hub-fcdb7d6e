import { createFileRoute } from "@tanstack/react-router";
import SlicerTestPage from "@/pages/SlicerTestPage";

export const Route = createFileRoute("/admin/slicer-test")({
  component: SlicerTestPage,
});
