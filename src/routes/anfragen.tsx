import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/anfragen")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/anfragen", replace: true });
  },
});
