import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/uploads")({
  beforeLoad: () => {
    throw redirect({ to: "/admin", replace: true });
  },
});
