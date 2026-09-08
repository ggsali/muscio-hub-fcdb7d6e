import { createFileRoute } from "@tanstack/react-router";
import ProjectsPage from "@/pages/site/ProjectsPage";

export const Route = createFileRoute("/_site/projekte/")({
  component: ProjectsPage,
});
