import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

import architektur from "@/assets/project-architektur.jpg";
import buehler from "@/assets/project-buehler.jpg";
import universitaet from "@/assets/project-universitaet.jpg";

type Shot = { id: string; url: string; alt: string };

const fallback: Shot[] = [
  { id: "f1", url: buehler, alt: "3D-gedrucktes Industrieteil aus Hochleistungs-Polymer" },
  { id: "f2", url: architektur, alt: "3D-gedrucktes Architekturmodell" },
  { id: "f3", url: universitaet, alt: "3D-gedruckter Prototyp für ein Forschungsprojekt" },
];

const resolve = (p: any): string => {
  if (p.bild_url) return p.bild_url;
  if (p.hero_image_path)
    return supabase.storage.from("projekte").getPublicUrl(p.hero_image_path).data.publicUrl;
  if (p.gallery_paths?.[0])
    return supabase.storage.from("projekte").getPublicUrl(p.gallery_paths[0]).data.publicUrl;
  return "";
};

/**
 * Moodboard aus echten 3D-Druck-Aufnahmen: gestaffeltes Bild-Grid für den Hero.
 */
export const HeroImageMosaic = () => {
  const [shots, setShots] = useState<Shot[]>(fallback);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("projekte")
        .select("id, name, kategorie, bild_url, hero_image_path, gallery_paths")
        .eq("aktiv", true)
        .order("sort_order", { ascending: true })
        .limit(6);
      if (!data) return;
      const mapped = data
        .map((p: any) => ({
          id: p.id,
          url: resolve(p),
          alt: `${p.name}${p.kategorie ? ` – ${p.kategorie}` : ""} · 3D-Druck von 3DMuscio`,
        }))
        .filter((s) => s.url)
        .slice(0, 3);
      if (mapped.length === 3) setShots(mapped);
    })();
  }, []);

  const [a, b, c] = shots;

  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4">
      <div className="col-span-2 group relative overflow-hidden rounded-3xl border border-border bg-muted aspect-[16/11]">
        <img
          src={a.url}
          alt={a.alt}
          loading="eager"
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" />
        <span className="absolute bottom-3 left-3 px-2.5 py-1 rounded-full bg-background/80 backdrop-blur border border-border/60 text-[10px] font-semibold uppercase tracking-widest text-foreground">
          Echte Kundenteile
        </span>
      </div>

      {[b, c].map((s, i) => (
        <div
          key={s.id}
          className={`group relative overflow-hidden rounded-2xl border border-border bg-muted aspect-square ${
            i === 0 ? "md:-mt-6" : "md:mt-4"
          }`}
        >
          <img
            src={s.url}
            alt={s.alt}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        </div>
      ))}
    </div>
  );
};

export default HeroImageMosaic;
