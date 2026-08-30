import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/auftraege/$id")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/auftraege", replace: true });
  },
});
