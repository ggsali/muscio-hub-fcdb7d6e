import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/teile")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/teile", replace: true });
  },
});
