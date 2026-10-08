import { createFileRoute } from "@tanstack/react-router";
import RegionPage from "@/pages/site/RegionPage";
import { buildHead } from "@/lib/seo-head";
import { regionBySlug } from "@/data/seo/regionen";

const data = regionBySlug("3d-druck-winterthur");

export const Route = createFileRoute("/_site/3d-druck-winterthur")({
  component: () => <RegionPage slug="3d-druck-winterthur" />,
  head: ({ matches }) => buildHead({ title: data?.title ?? "3D-Druck Schweiz | 3DMuscio", description: data?.description ?? "3D-Druck von 3DMuscio aus der Schweiz.", path: "/3d-druck-winterthur" }, matches.find((match) => match.routeId === "/_site")?.context.resinEnabled ?? false),
});
