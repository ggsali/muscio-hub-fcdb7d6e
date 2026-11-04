import { createFileRoute } from "@tanstack/react-router";
import SlicerTestPage from "@/pages/SlicerTestPage";

export const Route = createFileRoute("/labor/slicer")({
  component: SlicerTestPage,
});
