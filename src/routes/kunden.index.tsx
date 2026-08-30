import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/kunden/")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/kunden", replace: true });
  },
});
