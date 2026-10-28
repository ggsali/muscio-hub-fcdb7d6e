import { useEffect, useState } from "react";
import { Link } from "@/lib/router-compat";
import { ImageIcon, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface P {
  id: string;
  slug: string;
  name: string;
  kategorie: string | null;
  kurzbeschreibung: string | null;
  bild_url: string | null;
}

/** Zeigt veröffentlichte Projekte (Tabelle "projekte"), deren Kategorie das Stichwort enthält oder die den Tag tragen, mit Bildvorschau. Ohne Treffer wird nichts angezeigt. */
export default function ServiceProjects({ tag, slugs = [], tags = [], title = "Projekte" }: { tag: string; slugs?: string[]; tags?: string[]; title?: string }) {
  const [items, setItems] = useState<P[]>([]);

  useEffect(() => {
    let alive = true;
    supabase
      .from("projekte")
      .select("id, slug, name, kategorie, kurzbeschreibung, bild_url")
      .eq("aktiv", true)
      .or([`kategorie.ilike.%${tag}%`, `tags.cs.{${tag}}`, ...tags.map((t) => `tags.cs.{${t}}`), ...(slugs.length ? [`slug.in.(${slugs.join(",")})`] : [])].join(","))
      .order("sort_order", { ascending: true })
      .limit(6)
      .then(({ data }) => { if (alive) setItems((data as P[]) || []); });
    return () => { alive = false; };
  }, [tag, slugs.join(","), tags.join(",")]);

  if (items.length === 0) return null;

  return (
    <section className="container mx-auto px-4 pb-16">
      <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-6">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map((p) => (
          <Link
            key={p.id}
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
              {p.kategorie && <p className="text-[10px] uppercase tracking-widest text-primary font-semibold mb-1">{p.kategorie}</p>}
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-lg font-bold text-foreground">{p.name}</h3>
                <ArrowUpRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              {p.kurzbeschreibung && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.kurzbeschreibung}</p>}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
