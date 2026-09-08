import { useEffect, useState } from "react";
import { Link } from "@/lib/router-compat";
import { motion } from "framer-motion";
import { ImageIcon, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Seo from "@/components/site/Seo";
import { ScrollReveal } from "@/components/site/ScrollReveal";

interface Project {
  id: string;
  slug: string;
  name: string;
  kategorie: string | null;
  kurzbeschreibung: string | null;
  bild_url: string | null;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("projekte")
      .select("id, slug, name, kategorie, kurzbeschreibung, bild_url")
      .eq("aktiv", true)
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        setProjects((data as Project[]) || []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="3D-Druck Projekte | 3DMuscio"
        description="Entdecken Sie realisierte 3D-Druck-Projekte von 3DMuscio: Prototypen, Ersatzteile, Kleinserien und mehr – gefertigt in der Schweiz."
        path="/projekte"
      />

      <div className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-3xl mb-14">
          <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">Referenzen</p>
          <h1 className="font-heading text-3xl md:text-5xl font-extrabold text-foreground tracking-tight leading-[1.05] mb-4">
            Projekte aus der Werkstatt
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            Ein Auszug realisierter 3D-Druck-Projekte – von Prototypen über Ersatzteile bis hin zu Kleinserien.
          </p>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Lädt…</p>
        ) : projects.length === 0 ? (
          <p className="text-muted-foreground">Noch keine Projekte veröffentlicht.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map((p, i) => (
              <ScrollReveal key={p.id} delay={i * 0.05}>
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                >
                  <Link
                    to={`/projekte/${p.slug}`}
                    className="group relative block rounded-2xl overflow-hidden border border-border bg-card aspect-[4/3]"
                  >
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
                      {p.kurzbeschreibung && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.kurzbeschreibung}</p>
                      )}
                    </div>
                  </Link>
                </motion.div>
              </ScrollReveal>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
