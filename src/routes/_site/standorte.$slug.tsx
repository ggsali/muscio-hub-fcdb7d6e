import { createFileRoute, redirect } from "@tanstack/react-router";

// Alte /standorte/*-Seiten waren Duplikate der /3d-druck-*-Seiten → dauerhaft weiterleiten.
const ZIELE: Record<string, string> = {
  zuerich: "/3d-druck-zuerich",
  thurgau: "/3d-druck-thurgau",
  "st-gallen": "/3d-druck-st-gallen",
  ostschweiz: "/3d-druck-ostschweiz",
  winterthur: "/3d-druck-winterthur",
  bern: "/3d-druck-bern",
};

export const Route = createFileRoute("/_site/standorte/$slug")({
  beforeLoad: ({ params }) => {
    throw redirect({ href: ZIELE[params.slug] ?? "/3d-druck-schweiz", statusCode: 301 });
  },
});
