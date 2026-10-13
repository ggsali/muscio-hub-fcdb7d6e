import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_site/maschinen")({
  beforeLoad: () => {
    throw redirect({ to: "/", statusCode: 301 });
  },
});
