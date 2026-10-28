import { canonicalHead } from "@/lib/seo-head";
import { createFileRoute } from "@tanstack/react-router";
import WeihnachtenPage from "@/pages/site/WeihnachtenPage";

export const Route = createFileRoute("/_site/weihnachtsgeschenke")({
  head: () => canonicalHead("/weihnachtsgeschenke"),
  component: WeihnachtenPage,
});
