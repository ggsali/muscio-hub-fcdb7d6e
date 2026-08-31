import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, Navigate, useParams } from "@/lib/router-compat";
import { ArrowLeft, Calendar, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";

interface Post {
  id: string;
  slug: string;
  titel: string;
  inhalt: string;
  zusammenfassung: string | null;
  titelbild_url: string | null;
  autor: string;
  veroeffentlicht_am: string | null;
  tags: string[] | null;
  meta_title: string | null;
  meta_description: string | null;
}

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data } = await supabase
        .from("blog_posts" as any)
        .select("*")
        .eq("slug", slug)
        .eq("veroeffentlicht", true)
        .maybeSingle();
      if (!data) { setNotFound(true); setLoading(false); return; }
      setPost(data as unknown as Post);
      setLoading(false);
    })();
  }, [slug]);

  if (notFound) return <Navigate to="/blog" replace />;
  if (loading || !post) return <div className="container mx-auto px-4 py-20"><p className="text-muted-foreground">Lädt…</p></div>;

  const title = post.meta_title || `${post.titel} | 3DMuscio Blog`;
  const desc = (post.meta_description || post.zusammenfassung || post.inhalt.replace(/[#*_`>\-]/g, "").slice(0, 160)).slice(0, 160);
  const url = `https://3dmuscio.com/blog/${post.slug}`;

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={desc} />
        <meta property="og:title" content={post.titel} />
        <meta property="og:description" content={desc} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={url} />
        {post.titelbild_url && <meta property="og:image" content={post.titelbild_url} />}
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: post.titel,
          description: desc,
          image: post.titelbild_url || undefined,
          datePublished: post.veroeffentlicht_am || undefined,
          author: { "@type": "Person", name: post.autor },
          publisher: { "@id": "https://3dmuscio.com/#organization" },
          mainEntityOfPage: url,
        })}</script>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Start", item: "https://3dmuscio.com/" },
            { "@type": "ListItem", position: 2, name: "Blog", item: "https://3dmuscio.com/blog" },
            { "@type": "ListItem", position: 3, name: post.titel, item: url },
          ],
        })}</script>
      </Helmet>
      <article className="container mx-auto px-4 py-12 md:py-20 max-w-3xl">
        <Link to="/blog" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="w-4 h-4" /> Zurück zum Blog
        </Link>

        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {post.tags.map(t => (
              <span key={t} className="text-[10px] uppercase tracking-widest font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{t}</span>
            ))}
          </div>
        )}

        <h1 className="font-heading text-4xl md:text-5xl font-extrabold text-foreground tracking-tight leading-[1.1] mb-6">
          {post.titel}
        </h1>

        <div className="flex items-center gap-5 text-sm text-muted-foreground mb-8 pb-8 border-b border-border">
          <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> {post.autor}</span>
          {post.veroeffentlicht_am && (
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(post.veroeffentlicht_am).toLocaleDateString("de-CH", { day: "2-digit", month: "long", year: "numeric" })}
            </span>
          )}
        </div>

        {post.titelbild_url && (
          <img src={post.titelbild_url} alt={post.titel} loading="lazy" className="w-full rounded-2xl mb-10 border border-border" />
        )}

        <div className="prose prose-invert prose-headings:font-heading prose-headings:font-bold prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-a:text-primary prose-strong:text-foreground prose-li:text-muted-foreground prose-p:text-muted-foreground prose-p:leading-relaxed max-w-none">
          <ReactMarkdown>{post.inhalt}</ReactMarkdown>
        </div>
      </article>
    </div>
  );
}
