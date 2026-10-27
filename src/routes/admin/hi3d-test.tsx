import { createFileRoute } from "@tanstack/react-router";
import Hi3dTestPage from "@/pages/Hi3dTestPage";

export const Route = createFileRoute("/admin/hi3d-test")({
  component: Hi3dTestPage,
});
