import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight } from "lucide-react";
import { ScrollReveal } from "./ScrollReveal";

interface Project {
  id: string;
  slug: string;
  name: string;
  kategorie: string | null;
  bild_url: string | null;
}

/**
 * Kompakte Projekt-Vorschau (max. 3) für die Startseite.
 */
export const HomeProjectsPreview = () => {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    supabase
      .from("projekte")
      .select("id, slug, name, kategorie, bild_url")
      .eq("aktiv", true)
      .not("bild_url", "is", null)
      .order("sort_order", { ascending: true })
      .limit(3)
      .then(({ data }) => {
        if (data) setProjects(data as Project[]);
      });
  }, []);

  if (projects.length === 0) return null;

  return (
    <div>
      <div className="flex items-end justify-between mb-4">
        <p className="text-xs font-medium text-primary uppercase tracking-widest">Projekte</p>
        <Link
          to="/projekte"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors"
        >
          Alle Projekte <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        {projects.map((p, i) => (
          <ScrollReveal key={p.id} delay={i * 0.06}>
            <Link
              to={`/projekte/${p.slug}`}
              className="group relative block rounded-2xl overflow-hidden border border-border bg-card aspect-[4/3]"
            >
              <img
                src={p.bild_url!}
                alt={`${p.name}${p.kategorie ? ` – ${p.kategorie}` : ""}`}
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/25 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4">
                {p.kategorie && (
                  <p className="text-[10px] uppercase tracking-widest text-primary font-semibold mb-0.5">
                    {p.kategorie}
                  </p>
                )}
                <h3 className="font-heading text-base font-bold text-foreground">{p.name}</h3>
              </div>
            </Link>
          </ScrollReveal>
        ))}
      </div>
    </div>
  );
};

export default HomeProjectsPreview;
