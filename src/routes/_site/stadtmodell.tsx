import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { QUELLE } from "@/lib/stadtmodell";
import { useStadtmodellEnabled } from "@/hooks/useStadtmodellEnabled";
import { supabase } from "@/integrations/supabase/client";

const Konfigurator = lazy(() => import("@/components/stadtmodell/StadtmodellKonfigurator"));

export const Route = createFileRoute("/_site/stadtmodell")({
  head: () => ({
    meta: [
      { title: "3D-Stadtmodell konfigurieren | 3DMuscio" },
      { name: "description", content: "Wähle einen Ort in der Schweiz, bestimme Massstab, Sockel und Material – und bestelle dein 3D-gedrucktes Stadt- oder Geländemodell online." },
      { property: "og:title", content: "3D-Stadtmodell konfigurieren | 3DMuscio" },
      { property: "og:description", content: "Dein Lieblingsort als 3D-Druck: Gelände und Gebäude aus offenen Schweizer Geodaten." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StadtmodellPage,
});

function StadtmodellPage() {
  const [erfolg, setErfolg] = useState(false);
  useEffect(() => { setErfolg(new URLSearchParams(window.location.search).get("erfolg") === "1"); }, []);
  const aktiv = useStadtmodellEnabled();
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user.id;
      if (!uid) return;
      const { data: r } = await supabase.rpc("has_role", { _user_id: uid, _role: "admin" });
      setIsAdmin(!!r);
    });
  }, []);
  const fallback = <div className="h-[600px] animate-pulse rounded-xl bg-muted/30" />;
  return (
    <div className="container mx-auto max-w-7xl px-4 py-12">
      <h1 className="text-3xl font-bold md:text-4xl">3D-Stadtmodell konfigurieren</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">Wähle einen Ort, ziehe ein Quadrat von 100 bis 500 m auf und erhalte live Grösse und Preis deines gedruckten Modells.</p>
      {aktiv === false && isAdmin && (
        <div className="mt-6 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">Admin-Ansicht: Der Konfigurator ist für Besucher deaktiviert.</div>
      )}
      {aktiv === false && !isAdmin ? (
        <div className="mt-8 rounded-xl border border-border bg-card p-8 text-center">
          <h2 className="text-2xl font-semibold">Der Stadtmodell-Konfigurator ist derzeit pausiert</h2>
          <p className="mt-2 text-muted-foreground">Schau bald wieder vorbei oder kontaktiere uns für ein individuelles Stadtmodell.</p>
        </div>
      ) : erfolg ? (
        <div className="mt-8 rounded-xl border border-border bg-card p-8 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
          <h2 className="mt-4 text-2xl font-semibold">Vielen Dank für deine Bestellung!</h2>
          <p className="mt-2 text-muted-foreground">Wir drucken dein Stadtmodell und melden uns, sobald es versandt ist.</p>
          <p className="mt-4 text-xs text-muted-foreground">{QUELLE}</p>
        </div>
      ) : (
        <div className="mt-8">
          <ClientOnly fallback={fallback}><Suspense fallback={fallback}><Konfigurator /></Suspense></ClientOnly>
        </div>
      )}
    </div>
  );
}
