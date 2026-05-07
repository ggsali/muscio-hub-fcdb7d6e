import { useEffect, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowUpRight, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Project = {
  id: string; slug: string; name: string; kategorie: string | null;
  beschreibung: string | null; bild_url: string | null;
  verfahren: string | null; material: string | null;
  toleranz: string | null; lieferzeit: string | null;
  gallery_paths: string[] | null;
};

export default function ProjektDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [others, setOthers] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeImg, setActiveImg] = useState(0);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data } = await supabase
        .from("projekte")
        .select("id, slug, name, kategorie, beschreibung, bild_url, verfahren, material, toleranz, lieferzeit, gallery_paths")
        .eq("slug", slug).eq("aktiv", true).maybeSingle();
      if (!data) { setNotFound(true); setLoading(false); return; }
      setProject(data as Project);
      const { data: rest } = await supabase
        .from("projekte")
        .select("id, slug, name, kategorie, beschreibung, bild_url, verfahren, material, toleranz, lieferzeit, gallery_paths")
        .eq("aktiv", true).neq("slug", slug)
        .order("sort_order", { ascending: true }).limit(3);
      setOthers((rest as Project[]) || []);
      setLoading(false);
    })();
  }, [slug]);

  if (notFound) return <Navigate to="/" replace />;
  if (loading || !project) {
    return <div className="min-h-screen container mx-auto px-4 py-20"><p className="text-muted-foreground">Lädt…</p></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 md:py-20">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="w-4 h-4" /> Zurück zur Startseite
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="relative">
            <div className="absolute inset-[-30px] bg-primary/[0.05] rounded-3xl blur-[60px] pointer-events-none" />
            {(() => {
              const images = [project.bild_url, ...((project.gallery_paths as string[] | null) || [])].filter(Boolean) as string[];
              const current = images[activeImg] || project.bild_url;
              return (
                <div className="relative space-y-3">
                  <div className="relative rounded-2xl overflow-hidden border border-border bg-card aspect-square flex items-center justify-center">
                    {current ? (
                      <img src={current} alt={project.name} className="w-full h-full object-cover transition-opacity duration-300" />
                    ) : (
                      <ImageIcon className="w-16 h-16 text-muted-foreground/40" />
                    )}
                  </div>
                  {images.length > 1 && (
                    <div className="grid grid-cols-5 gap-2">
                      {images.map((url, i) => (
                        <button
                          key={i}
                          onClick={() => setActiveImg(i)}
                          className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${i === activeImg ? "border-primary" : "border-border hover:border-primary/50"}`}
                        >
                          <img src={url} alt={`${project.name} ${i + 1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
            {project.kategorie && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-xs font-medium text-primary mb-6 tracking-wide uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                {project.kategorie}
              </div>
            )}
            <h1 className="font-heading text-4xl md:text-5xl font-extrabold text-foreground tracking-tight mb-6 leading-[1.05]">{project.name}</h1>
            {project.beschreibung && (
              <p className="text-base text-muted-foreground leading-relaxed mb-10 whitespace-pre-line">{project.beschreibung}</p>
            )}

            {(project.verfahren || project.material || project.toleranz || project.lieferzeit) && (
              <div className="grid grid-cols-2 gap-3 mb-10">
                {[
                  { label: "Verfahren", value: project.verfahren },
                  { label: "Material", value: project.material },
                  { label: "Toleranz", value: project.toleranz },
                  { label: "Lieferzeit", value: project.lieferzeit },
                ].filter(s => s.value).map(s => (
                  <div key={s.label} className="rounded-xl border border-border bg-card/60 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium mb-1">{s.label}</p>
                    <p className="font-heading text-base font-bold text-foreground">{s.value}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild size="lg" className="rounded-full">
                <Link to="/kalkulator-online">Eigenes Projekt anfragen <ArrowUpRight className="w-4 h-4 ml-1.5" /></Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-full">
                <Link to="/kontakt">Kontakt aufnehmen</Link>
              </Button>
            </div>
          </motion.div>
        </div>

        {others.length > 0 && (
          <div className="mt-24">
            <p className="text-xs font-medium text-primary uppercase tracking-widest mb-6">Weitere Projekte</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {others.map(p => (
                <Link key={p.id} to={`/projekte/${p.slug}`} className="group relative rounded-2xl overflow-hidden border border-border bg-card aspect-[4/3]">
                  {p.bild_url ? (
                    <img src={p.bild_url} alt={p.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  ) : (
                    <div className="absolute inset-0 bg-muted flex items-center justify-center"><ImageIcon className="w-10 h-10 text-muted-foreground/40" /></div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/30 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-5">
                    {p.kategorie && <p className="text-[10px] uppercase tracking-widest text-primary font-semibold mb-1">{p.kategorie}</p>}
                    <h3 className="font-heading text-lg font-bold text-foreground">{p.name}</h3>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
