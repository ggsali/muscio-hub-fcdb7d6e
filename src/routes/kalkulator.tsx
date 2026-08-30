import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/kalkulator")({
  beforeLoad: () => {
    throw redirect({ to: "/kalkulator-online", replace: true });
  },
});
