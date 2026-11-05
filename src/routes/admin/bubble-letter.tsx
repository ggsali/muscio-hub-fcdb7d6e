import { createFileRoute } from "@tanstack/react-router";
import BubbleLetterPage from "@/pages/BubbleLetterPage";

export const Route = createFileRoute("/admin/bubble-letter")({
  component: BubbleLetterPage,
});
