import { createFileRoute } from "@tanstack/react-router";
import ProjectUploadPage from "@/pages/ProjectUploadPage";

export const Route = createFileRoute("/upload/$token")({
  component: ProjectUploadPage,
});
