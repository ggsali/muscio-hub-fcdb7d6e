import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/filamente")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/filamente", replace: true });
  },
});
