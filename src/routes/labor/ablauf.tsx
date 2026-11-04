import { createFileRoute } from "@tanstack/react-router";
import LaborAblaufPage from "@/pages/LaborAblaufPage";

export const Route = createFileRoute("/labor/ablauf")({
  component: LaborAblaufPage,
});
