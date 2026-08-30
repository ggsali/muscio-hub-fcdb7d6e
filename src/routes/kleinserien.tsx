import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/kleinserien")({
  beforeLoad: () => {
    throw redirect({ to: "/leistungen/3d-druck-kleinserien", replace: true });
  },
});
