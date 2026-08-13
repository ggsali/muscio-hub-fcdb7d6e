import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

import architektur from "@/assets/project-architektur.jpg";
import buehler from "@/assets/project-buehler.jpg";
import universitaet from "@/assets/project-universitaet.jpg";

type Shot = { id: string; url: string; alt: string; slug?: string; name?: string; kategorie?: string };

const fallback: Shot[] = [
  { id: "f1", url: buehler, alt: "3D-gedrucktes Industrieteil aus Hochleistungs-Polymer", slug: "buehler", name: "Bühler Industrieteil" },
  { id: "f2", url: architektur, alt: "3D-gedrucktes Architekturmodell", slug: "architektur", name: "Architekturmodell" },
  { id: "f3", url: universitaet, alt: "3D-gedruckter Prototyp für ein Forschungsprojekt", slug: "universitaet", name: "Universitäts-Prototyp" },
];

const resolve = (p: any): string => {
  if (p.bild_url) return p.bild_url;
  if (p.hero_image_path)
    return supabase.storage.from("projekte").getPublicUrl(p.hero_image_path).data.publicUrl;
  if (p.gallery_paths?.[0])
    return supabase.storage.from("projekte").getPublicUrl(p.gallery_paths[0]).data.publicUrl;
  return "";
};

/** Ein Slot des Moodboards: rotiert durch die Bilder und verlinkt aufs Projekt. */
const Slot = ({
  shots,
  offset,
  step,
  className,
  eager,
  badge,
}: {
  shots: Shot[];
  offset: number;
  step: number;
  className: string;
  eager?: boolean;
  badge?: boolean;
}) => {
  const shot = shots[(offset + step * 1) % shots.length] ?? shots[0];
  if (!shot) return null;

  const inner = (
    <>
      <AnimatePresence mode="wait">
        <motion.img
          key={shot.id + step}
          src={shot.url}
          alt={shot.alt}
          loading={eager ? "eager" : "lazy"}
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      </AnimatePresence>
      <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-background/10 to-transparent" />
      {badge && (
        <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-background/80 backdrop-blur border border-border/60 text-[10px] font-semibold uppercase tracking-widest text-foreground">
          Echte Kundenteile
        </span>
      )}
      {shot.name && (
        <span className="absolute bottom-3 left-3 right-3 text-xs md:text-sm font-heading font-bold text-foreground truncate">
          {shot.name}
        </span>
      )}
    </>
  );

  const base = `group relative overflow-hidden bg-muted border border-border ${className}`;

  return shot.slug ? (
    <Link to={`/projekte/${shot.slug}`} className={base} aria-label={shot.name || "Projekt ansehen"}>
      {inner}
    </Link>
  ) : (
    <div className={base}>{inner}</div>
  );
};

/**
 * Moodboard aus echten 3D-Druck-Aufnahmen: gestaffeltes Bild-Grid, das
 * automatisch durch die Projekte rotiert und aufs Projekt verlinkt.
 */
export const HeroImageMosaic = () => {
  const [shots, setShots] = useState<Shot[]>(fallback);
  const [step, setStep] = useState(0);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("projekte")
        .select("id, slug, name, kategorie, bild_url, hero_image_path, gallery_paths")
        .eq("aktiv", true)
        .order("sort_order", { ascending: true })
        .limit(12);
      if (!data) return;
      const mapped = data
        .map((p: any) => ({
          id: p.id,
          slug: p.slug,
          name: p.name,
          kategorie: p.kategorie || undefined,
          url: resolve(p),
          alt: `${p.name}${p.kategorie ? ` – ${p.kategorie}` : ""} · 3D-Druck von 3DMuscio`,
        }))
        .filter((s) => s.url);
      if (mapped.length >= 3) setShots(mapped);
    })();
  }, []);

  useEffect(() => {
    if (shots.length <= 3) return;
    const id = setInterval(() => setStep((s) => s + 1), 5000);
    return () => clearInterval(id);
  }, [shots.length]);

  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4">
      <Slot
        shots={shots}
        offset={0}
        step={step}
        eager
        badge
        className="col-span-2 rounded-3xl aspect-[16/11]"
      />
      <Slot shots={shots} offset={1} step={step} className="rounded-2xl aspect-square md:-mt-6" />
      <Slot shots={shots} offset={2} step={step} className="rounded-2xl aspect-square md:mt-4" />
    </div>
  );
};

export default HeroImageMosaic;
