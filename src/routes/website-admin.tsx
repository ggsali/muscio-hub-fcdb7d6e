import { createFileRoute } from "@tanstack/react-router";
import WebsiteAdminLayout from "@/components/WebsiteAdminLayout";

export const Route = createFileRoute("/website-admin")({
  component: () => <WebsiteAdminLayout />,
});
