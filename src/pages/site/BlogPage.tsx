import { useEffect, useState } from "react";
import { Link } from "@/lib/router-compat";
import { motion } from "framer-motion";
import { ArrowUpRight, Calendar, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Seo from "@/components/site/Seo";

interface Post {
  id: string;
  slug: string;
  titel: string;
  zusammenfassung: string | null;
  titelbild_url: string | null;
  autor: string;
  veroeffentlicht_am: string | null;
  tags: string[] | null;
}

export default function BlogPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("blog_posts" as any)
        .select("id, slug, titel, zusammenfassung, titelbild_url, autor, veroeffentlicht_am, tags")
        .eq("veroeffentlicht", true)
        .order("veroeffentlicht_am", { ascending: false });
      setPosts((data as unknown as Post[]) || []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Blog – Wissen rund um 3D Druck | 3DMuscio"
        description="Artikel, Tipps und Praxiswissen zum 3D Druck: Materialwahl, Konstruktion, Nachbearbeitung und Anwendungsbeispiele aus der Schweiz."
        path="/blog"
      />
      <div className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-3xl mb-14">
          <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">Blog & News</p>
          <h1 className="font-heading text-3xl md:text-5xl font-extrabold text-foreground tracking-tight leading-[1.05] mb-4">
            Wissen rund um den 3D-Druck
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            Materialien, Tipps und Neuigkeiten aus der Welt der additiven Fertigung.
          </p>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Lädt…</p>
        ) : posts.length === 0 ? (
          <p className="text-muted-foreground">Noch keine Beiträge veröffentlicht.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
              >
                <Link
                  to={`/blog/${p.slug}`}
                  className="group block rounded-2xl overflow-hidden border border-border bg-card hover:border-primary/50 transition-all"
                >
                  <div className="h-[160px] md:h-auto md:aspect-[16/9] bg-muted relative">
                    {p.titelbild_url ? (
                      <img src={p.titelbild_url} alt={p.titel} loading="lazy" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center"><ImageIcon className="w-10 h-10 text-muted-foreground/40" /></div>
                    )}
                  </div>
                  <div className="p-5">
                    {p.tags && p.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {p.tags.slice(0, 3).map(t => (
                          <span key={t} className="text-[10px] uppercase tracking-widest font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{t}</span>
                        ))}
                      </div>
                    )}
                    <h2 className="font-heading text-lg font-bold text-foreground mb-2 leading-tight group-hover:text-primary transition-colors">
                      {p.titel}
                    </h2>
                    {p.zusammenfassung && (
                      <p className="text-sm text-muted-foreground leading-relaxed mb-4 line-clamp-3">{p.zusammenfassung}</p>
                    )}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" />
                        {p.veroeffentlicht_am ? new Date(p.veroeffentlicht_am).toLocaleDateString("de-CH", { day: "2-digit", month: "long", year: "numeric" }) : ""}
                      </span>
                      <span className="text-primary font-medium flex items-center gap-1">Lesen <ArrowUpRight className="w-3 h-3" /></span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
