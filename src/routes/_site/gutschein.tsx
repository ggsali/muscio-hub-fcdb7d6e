import { createFileRoute } from "@tanstack/react-router";
import GutscheinKaufenPage from "@/pages/site/GutscheinKaufenPage";

export const Route = createFileRoute("/_site/gutschein")({
  component: GutscheinKaufenPage,
  head: () => ({
    meta: [
      { title: "3D-Druck Gutschein kaufen | 3DMuscio Schweiz" },
      {
        name: "description",
        content:
          "Verschenke 3D-Druck: Gutschein von 3DMuscio in CHF 25, 50, 100 oder Wunschbetrag. Sofort per E-Mail, 12 Monate gültig, einlösbar im Shop und Kalkulator.",
      },
      { property: "og:title", content: "3D-Druck Gutschein kaufen | 3DMuscio" },
      {
        property: "og:description",
        content: "Gutschein für 3D-Druck aus der Schweiz – sofort per E-Mail, 12 Monate gültig.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
