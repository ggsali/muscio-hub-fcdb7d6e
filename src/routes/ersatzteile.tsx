import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/ersatzteile")({
  beforeLoad: () => {
    throw redirect({ to: "/leistungen/3d-druck-ersatzteile", replace: true });
  },
});
