import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/prototypen")({
  beforeLoad: () => {
    throw redirect({ to: "/leistungen/3d-druck-prototypen", replace: true });
  },
});
