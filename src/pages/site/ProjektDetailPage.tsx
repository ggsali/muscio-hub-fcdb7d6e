import { lazy, Suspense, useEffect, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowUpRight, ImageIcon, Box } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import Seo from "@/components/site/Seo";

const StlViewer = lazy(() => import("@/components/site/StlViewer"));

type Project = {
  id: string; slug: string; name: string; kategorie: string | null;
  beschreibung: string | null; bild_url: string | null;
  verfahren: string | null; material: string | null;
  toleranz: string | null; lieferzeit: string | null;
  gallery_paths: string[] | null;
  stl_url: string | null;
  kurzbeschreibung?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  tags?: string[] | null;
  json_ld?: Record<string, unknown> | null;
};

export default function ProjektDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [others, setOthers] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeImg, setActiveImg] = useState(0);
  const [view3d, setView3d] = useState(false);
  const [stlSignedUrl, setStlSignedUrl] = useState<string | null>(null);

  // Kurzlebige Signed URL (5 Min) für die 3D-Vorschau statt dauerhafter Public URL
  useEffect(() => {
    if (!view3d || !project?.stl_url) return;
    let active = true;
    (async () => {
      const marker = "/project-stls/";
      const idx = project.stl_url!.indexOf(marker);
      if (idx === -1) { setStlSignedUrl(project.stl_url); return; }
      const path = decodeURIComponent(project.stl_url!.substring(idx + marker.length));
      const { data } = await supabase.storage.from("project-stls").createSignedUrl(path, 300);
      if (active) setStlSignedUrl(data?.signedUrl || project.stl_url);
    })();
    return () => { active = false; };
  }, [view3d, project?.stl_url]);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data } = await supabase
        .from("projekte")
        .select("id, slug, name, kategorie, beschreibung, kurzbeschreibung, bild_url, verfahren, material, toleranz, lieferzeit, gallery_paths, stl_url, seo_title, seo_description, tags, json_ld")
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

  const pageTitle = project.seo_title || project.name;
  const pageDescription = project.seo_description || project.kurzbeschreibung || "";
  const pagePath = `/projekte/${slug}`;
  const jsonLd = project.json_ld || undefined;

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title={pageTitle}
        description={pageDescription}
        path={pagePath}
        type="article"
        jsonLd={jsonLd}
      />
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
                    {view3d && project.stl_url ? (
                      stlSignedUrl ? (
                      <Suspense fallback={<div className="text-muted-foreground text-sm">Lädt 3D-Modell…</div>}>
                        <StlViewer url={stlSignedUrl} />
                      </Suspense>
                      ) : (
                        <div className="text-muted-foreground text-sm">Lädt 3D-Modell…</div>
                      )
                    ) : current ? (
                      <img src={current} alt={project.name} loading="lazy" className="w-full h-full object-cover transition-opacity duration-300" />
                    ) : (
                      <ImageIcon className="w-16 h-16 text-muted-foreground/40" />
                    )}
                    {project.stl_url && (
                      <button
                        onClick={() => setView3d(v => !v)}
                        className="absolute top-3 right-3 bg-background/80 backdrop-blur border border-border rounded-full px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 hover:bg-background"
                      >
                        <Box className="w-3.5 h-3.5" /> {view3d ? "Bild" : "3D-Ansicht"}
                      </button>
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
                          <img src={url} alt={`${project.name} ${i + 1}`} loading="lazy" className="w-full h-full object-cover" />
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
              <p className="text-base text-muted-foreground leading-relaxed mb-6 whitespace-pre-line">{project.beschreibung}</p>
            )}

            {project.tags && project.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-8">
                {project.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="rounded-full text-xs font-medium">
                    {tag}
                  </Badge>
                ))}
              </div>
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

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mt-20 rounded-2xl border border-border bg-card/50 p-8 md:p-12 text-center"
        >
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-4">
            Auch ein Modell oder Prototyp für Ihr Unternehmen?
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-8">
            Wir beraten Sie gerne persönlich und erstellen Ihnen ein massgeschneidertes Angebot für Ihr nächstes 3D-Druck-Projekt.
          </p>
          <Button asChild size="lg" className="rounded-full">
            <Link to="/kontakt">Jetzt Anfrage stellen <ArrowUpRight className="w-4 h-4 ml-1.5" /></Link>
          </Button>
        </motion.div>

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
