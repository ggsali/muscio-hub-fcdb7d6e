import { createFileRoute } from "@tanstack/react-router";
import UeberUnsPage from "@/pages/site/UeberUnsPage";

export const Route = createFileRoute("/_site/ueber-uns")({
  component: UeberUnsPage,
});
