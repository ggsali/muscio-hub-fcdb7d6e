import { createFileRoute } from "@tanstack/react-router";
import ServerDateienPage from "@/pages/ServerDateienPage";

export const Route = createFileRoute("/admin/server-dateien")({
  component: ServerDateienPage,
});
