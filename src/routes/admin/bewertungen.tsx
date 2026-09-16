import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/bewertungen")({
  loader: () => {
    throw redirect({ to: "/website-admin/reviews", replace: true });
  },
});
