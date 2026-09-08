import { createFileRoute } from "@tanstack/react-router";
import ContactPage from "@/pages/site/ContactPage";
import { buildHead } from "@/lib/seo-head";

export const Route = createFileRoute("/_site/kontakt")({
  component: ContactPage,
  head: () =>
    buildHead({
      title: "Kontakt & Anfrage – 3DMuscio 3D-Druckservice Schweiz",
      description:
        "Kontakt zu 3DMuscio in Eschlikon TG: Anfrage senden, Dateien hochladen oder direkt per E-Mail an info@3dmuscio.com. Antwort in der Regel innerhalb eines Werktags.",
      path: "/kontakt",
    }),
});
