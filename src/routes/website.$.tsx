import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/website/$")({
  beforeLoad: () => {
    throw redirect({ to: "/admin", replace: true });
  },
});
