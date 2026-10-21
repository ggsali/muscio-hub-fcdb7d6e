import { createFileRoute } from "@tanstack/react-router";
import WeihnachtenPage from "@/pages/site/WeihnachtenPage";

export const Route = createFileRoute("/_site/weihnachtsgeschenke")({
  component: WeihnachtenPage,
});
