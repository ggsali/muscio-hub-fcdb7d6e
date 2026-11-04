import { createFileRoute } from "@tanstack/react-router";
import SpardoseTestPage from "@/pages/SpardoseTestPage";

export const Route = createFileRoute("/labor/spardose")({
  component: SpardoseTestPage,
});
