import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type HeroProject = {
  id: string;
  slug: string;
  name: string;
  kategorie: string;
  beschreibung: string;
  bild_url: string;
};

const fallback: HeroProject[] = [];

const resolveImage = (p: any): string => {
  if (p.bild_url) return p.bild_url;
  if (p.hero_image_path) {
    return supabase.storage.from("projekte").getPublicUrl(p.hero_image_path).data.publicUrl;
  }
  if (p.gallery_paths?.[0]) {
    return supabase.storage.from("projekte").getPublicUrl(p.gallery_paths[0]).data.publicUrl;
  }
  return "";
};

export const HeroProjectsCarousel = () => {
  const [projects, setProjects] = useState<HeroProject[]>([]);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("projekte")
        .select("id, slug, name, kategorie, kurzbeschreibung, beschreibung, bild_url, hero_image_path, gallery_paths")
        .eq("aktiv", true)
        .eq("featured", true)
        .order("sort_order")
        .limit(8);
      if (data && data.length > 0) {
        const mapped: HeroProject[] = data.map((p: any) => ({
          id: p.id,
          slug: p.slug,
          name: p.name,
          kategorie: p.kategorie || "Projekt",
          beschreibung: p.kurzbeschreibung || p.beschreibung || "",
          bild_url: resolveImage(p),
        })).filter(p => p.bild_url);
        if (mapped.length > 0) setProjects(mapped);
      }
    })();
  }, []);

  const next = useCallback(() => {
    setDirection(1);
    setIndex(i => (i + 1) % projects.length);
  }, [projects.length]);
  const prev = useCallback(() => {
    setDirection(-1);
    setIndex(i => (i - 1 + projects.length) % projects.length);
  }, [projects.length]);

  useEffect(() => {
    if (projects.length <= 1) return;
    const id = setInterval(next, 6000);
    return () => clearInterval(id);
  }, [next, projects.length]);

  // Falls Index außerhalb (z.B. nach DB-Reload mit weniger Projekten)
  useEffect(() => { if (index >= projects.length) setIndex(0); }, [projects.length, index]);

  const project = projects[index] || projects[0];
  if (!project) return null;

  return (
    <div className="relative w-full max-w-[460px] mx-auto">
      <div className="absolute inset-[-40px] bg-primary/[0.05] rounded-3xl blur-[60px] pointer-events-none" />

      <div className="relative bg-card/60 backdrop-blur-sm border border-border/60 rounded-3xl p-4 sm:p-5 shadow-2xl overflow-hidden">
        <div className="relative aspect-[4/5] sm:aspect-[4/4] rounded-2xl overflow-hidden bg-muted">
          <AnimatePresence custom={direction} mode="wait">
            <motion.div
              key={project.id}
              custom={direction}
              initial={{ opacity: 0, x: direction * 60, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -direction * 60, scale: 0.98 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0"
            >
              <Link to={`/projekte/${project.slug}`} className="block w-full h-full group">
                <img
                  src={project.bild_url}
                  alt={`${project.name} – ${project.kategorie}`}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/40 to-transparent" />

                <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background/80 backdrop-blur border border-border/60 text-[10px] font-medium uppercase tracking-widest text-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  {project.kategorie}
                </div>

                <div className="absolute inset-x-0 bottom-0 p-5">
                  <h3 className="font-heading text-xl sm:text-2xl font-bold text-foreground leading-tight mb-1.5">
                    {project.name}
                  </h3>
                  {project.beschreibung && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{project.beschreibung}</p>
                  )}
                </div>
              </Link>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between mt-4 px-1">
          <div className="flex items-center gap-1.5">
            {projects.map((p, i) => (
              <button
                key={p.id}
                onClick={() => { setDirection(i > index ? 1 : -1); setIndex(i); }}
                aria-label={`Projekt ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${i === index ? "w-6 bg-primary" : "w-1.5 bg-border hover:bg-muted-foreground/40"}`}
              />
            ))}
            <span className="ml-3 text-[10px] font-mono text-muted-foreground tabular-nums">
              {String(index + 1).padStart(2, "0")} / {String(projects.length).padStart(2, "0")}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={prev} aria-label="Vorheriges Projekt" className="w-9 h-9 rounded-full border border-border bg-background/60 hover:bg-primary hover:text-primary-foreground hover:border-primary flex items-center justify-center transition-all">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button onClick={next} aria-label="Nächstes Projekt" className="w-9 h-9 rounded-full border border-border bg-background/60 hover:bg-primary hover:text-primary-foreground hover:border-primary flex items-center justify-center transition-all">
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
