import { createFileRoute } from "@tanstack/react-router";
import UeberKiPage from "@/pages/site/UeberKiPage";

export const Route = createFileRoute("/_site/ueber-ki")({
  component: UeberKiPage,
});
