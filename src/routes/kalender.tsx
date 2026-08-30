import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/kalender")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/kalender", replace: true });
  },
});
