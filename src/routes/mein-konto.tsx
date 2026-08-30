import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/mein-konto")({
  beforeLoad: () => {
    throw redirect({ to: "/portal", replace: true });
  },
});
