import { createFileRoute } from "@tanstack/react-router";
import SpardoseTestPage from "@/pages/SpardoseTestPage";

export const Route = createFileRoute("/admin/spardose-test")({
  component: SpardoseTestPage,
});
