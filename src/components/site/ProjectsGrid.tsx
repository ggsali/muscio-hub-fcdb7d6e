import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ImageIcon, ArrowUpRight } from "lucide-react";
import { ScrollReveal } from "./ScrollReveal";

interface Project {
  id: string; slug: string; name: string; kategorie: string | null;
  kurzbeschreibung: string | null; bild_url: string | null;
}

export function ProjectsGrid() {
  const [projects, setProjects] = useState<Project[]>([]);
  useEffect(() => {
    supabase.from("projekte")
      .select("id, slug, name, kategorie, kurzbeschreibung, bild_url")
      .eq("aktiv", true)
      .order("sort_order", { ascending: true })
      .limit(6)
      .then(({ data }) => { if (data) setProjects(data as Project[]); });
  }, []);

  if (projects.length === 0) return null;

  return (
    <section className="py-28">
      <div className="container mx-auto px-4">
        <ScrollReveal>
          <div className="flex items-end justify-between mb-12">
            <div>
              <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">Projekte</p>
              <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground tracking-tight">
                Aus der Werkstatt.
              </h2>
            </div>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((p, i) => (
            <ScrollReveal key={p.id} delay={i * 0.05}>
              <Link to={`/projekte/${p.slug}`} className="group relative block rounded-2xl overflow-hidden border border-border bg-card aspect-[4/3]">
                <div className="absolute inset-0 bg-muted flex items-center justify-center">
                  <ImageIcon className="w-10 h-10 text-muted-foreground/40" />
                </div>
                {p.bild_url && (
                  <img
                    src={p.bild_url}
                    alt={p.name}
                    loading="lazy"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/30 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5">
                  {p.kategorie && (
                    <p className="text-[10px] uppercase tracking-widest text-primary font-semibold mb-1">{p.kategorie}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <h3 className="font-heading text-lg font-bold text-foreground">{p.name}</h3>
                    <ArrowUpRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </Link>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
