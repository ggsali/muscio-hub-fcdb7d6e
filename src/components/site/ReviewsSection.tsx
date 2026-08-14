import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Star, Quote, PenLine, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { ScrollReveal } from "./ScrollReveal";
import { Button } from "@/components/ui/button";

interface Review {
  id: string;
  customer_name: string;
  kommentar: string | null;
  rating: number;
  created_at: string;
}

const AVATAR_COLORS = [
  "bg-primary/15 text-primary",
  "bg-blue-500/15 text-blue-500",
  "bg-amber-500/15 text-amber-500",
  "bg-emerald-500/15 text-emerald-600",
  "bg-pink-500/15 text-pink-500",
  "bg-violet-500/15 text-violet-500",
];

function initials(name: string) {
  return name.split(" ").map(p => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("de-CH", { month: "short", year: "numeric" });
}

export function ReviewsSection() {
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    supabase.from("public_reviews")
      .select("id, customer_name, kommentar, rating, created_at")
      .order("created_at", { ascending: false })
      .limit(9)
      .then(({ data }) => { if (data) setReviews(data as Review[]); });

  }, []);

  const avg = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : "5.0";

  return (
    <section className="py-24 md:py-32 relative overflow-hidden">
      {/* Background flares */}
      <div className="absolute top-0 -left-40 w-[500px] h-[500px] bg-primary/[0.05] rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 -right-40 w-[500px] h-[500px] bg-primary/[0.04] rounded-full blur-[120px] pointer-events-none" />

      <div className="container mx-auto px-4 relative">
        {/* Header */}
        <ScrollReveal>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-end mb-14">
            <div className="md:col-span-7">
              <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">Kundenstimmen</p>
              <h2 className="font-heading text-4xl md:text-5xl font-extrabold text-foreground tracking-tight leading-[1.05]">
                Echte Erfahrungen.<br />
                <span className="text-primary">Echte Menschen.</span>
              </h2>
            </div>
            <div className="md:col-span-5 md:text-right">
              {reviews.length > 0 && (
                <div className="inline-flex items-center gap-3 bg-card border border-border rounded-2xl px-5 py-3">
                  <div className="flex">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} className="w-4 h-4 fill-primary text-primary" />
                    ))}
                  </div>
                  <div className="text-left">
                    <p className="font-heading text-xl font-bold leading-none">{avg}</p>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">{reviews.length}+ Bewertungen</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </ScrollReveal>

        {reviews.length === 0 ? (
          <ScrollReveal>
            <div className="max-w-md mx-auto text-center bg-card border border-dashed border-border rounded-2xl p-10">
              <Quote className="w-8 h-8 text-primary/40 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm mb-5">Noch keine Bewertungen — sei der erste!</p>
              <Button asChild>
                <Link to="/bewertung"><PenLine className="w-4 h-4 mr-2" />Bewertung schreiben</Link>
              </Button>
            </div>
          </ScrollReveal>
        ) : (
          <>
            {/* Masonry-like columns */}
            <div className="columns-1 md:columns-2 lg:columns-3 gap-5 max-w-6xl mx-auto [&>*]:mb-5 [&>*]:break-inside-avoid">
              {reviews.map((r, i) => {
                const [name, role] = r.customer_name.includes(" · ")
                  ? r.customer_name.split(" · ")
                  : [r.customer_name, ""];
                const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
                const isFeature = i === 0 || i === 4;

                return (
                  <ScrollReveal key={r.id} delay={Math.min(i * 0.04, 0.3)}>
                    <motion.div
                      whileHover={{ y: -4 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      className={`relative rounded-2xl p-6 border transition-colors ${
                        isFeature
                          ? "bg-gradient-to-br from-primary/[0.08] to-card border-primary/30"
                          : "bg-card border-border hover:border-primary/30"
                      }`}
                    >
                      <Quote className={`absolute top-5 right-5 w-7 h-7 ${isFeature ? "text-primary/40" : "text-primary/20"}`} />

                      <div className="flex gap-0.5 mb-4">
                        {Array.from({ length: 5 }).map((_, j) => (
                          <Star key={j} className={`w-4 h-4 ${j < r.rating ? "fill-primary text-primary" : "text-border"}`} />
                        ))}
                      </div>

                      <p className={`text-foreground leading-relaxed mb-5 ${isFeature ? "text-base font-medium" : "text-sm"}`}>
                        {r.kommentar}
                      </p>

                      <div className="flex items-center gap-3 pt-4 border-t border-border/60">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ${color}`}>
                          {initials(name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground leading-tight truncate">{name}</p>
                          <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                            {role || formatDate(r.created_at)}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  </ScrollReveal>
                );
              })}
            </div>

            {/* CTA */}
            <ScrollReveal>
              <div className="mt-14 text-center">
                <div className="inline-flex flex-col sm:flex-row items-center gap-4 bg-card border border-border rounded-2xl p-6 md:p-7 max-w-2xl mx-auto">
                  <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                    <PenLine className="w-5 h-5 text-primary" />
                  </div>
                  <div className="text-center sm:text-left flex-1">
                    <h3 className="font-heading text-base font-bold text-foreground mb-0.5">Du warst Kunde?</h3>
                    <p className="text-sm text-muted-foreground">Teile deine Erfahrung in unter 1 Minute.</p>
                  </div>
                  <Button asChild className="flex-shrink-0">
                    <Link to="/bewertung">
                      Bewertung schreiben <ArrowRight className="w-4 h-4 ml-1" />
                    </Link>
                  </Button>
                </div>
              </div>
            </ScrollReveal>
          </>
        )}
      </div>
    </section>
  );
}
