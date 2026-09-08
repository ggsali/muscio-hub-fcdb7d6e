import { createFileRoute } from "@tanstack/react-router";
import RegionPage from "@/pages/site/RegionPage";
import { buildHead } from "@/lib/seo-head";
import { regionBySlug } from "@/data/seo/regionen";

const data = regionBySlug("3d-druck-zuerich")!;

export const Route = createFileRoute("/_site/3d-druck-zuerich")({
  component: () => <RegionPage slug="3d-druck-zuerich" />,
  head: () => buildHead({ title: data.title, description: data.description, path: "/3d-druck-zuerich" }),
});
