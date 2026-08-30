import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/kunden/$id")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/kunden", replace: true });
  },
});
