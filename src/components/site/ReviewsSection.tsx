import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Star, Quote } from "lucide-react";
import { motion } from "framer-motion";
import { ScrollReveal } from "./ScrollReveal";

interface Review {
  id: string;
  customer_name: string;
  kommentar: string | null;
  rating: number;
  created_at: string;
}

export function ReviewsSection() {
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    supabase.from("reviews")
      .select("id, customer_name, kommentar, rating, created_at")
      .eq("freigegeben", true)
      .eq("sichtbar_auf_website", true)
      .order("created_at", { ascending: false })
      .limit(8)
      .then(({ data }) => { if (data) setReviews(data as Review[]); });
  }, []);

  if (reviews.length === 0) return null;

  return (
    <section className="py-28 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-primary/[0.04] rounded-full blur-[120px] pointer-events-none" />
      <div className="container mx-auto px-4">
        <ScrollReveal>
          <div className="text-center mb-14">
            <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">Bewertungen</p>
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground tracking-tight">
              Was unsere Kunden sagen.
            </h2>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
          {reviews.map((r, i) => {
            const [name, role] = r.customer_name.includes(" · ") ? r.customer_name.split(" · ") : [r.customer_name, ""];
            return (
              <ScrollReveal key={r.id} delay={i * 0.06}>
                <motion.div
                  whileHover={{ y: -3 }}
                  className="relative bg-card border border-border rounded-2xl p-6 h-full flex flex-col"
                >
                  <Quote className="absolute top-4 right-4 w-5 h-5 text-primary/20" />
                  <div className="flex gap-0.5 mb-4">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} className={`w-3.5 h-3.5 ${j < r.rating ? "fill-primary text-primary" : "text-border"}`} />
                    ))}
                  </div>
                  <p className="text-sm text-foreground leading-relaxed mb-5 flex-1">{r.kommentar}</p>
                  <div className="flex items-center gap-3 pt-4 border-t border-border">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                      {name.split(" ").map(p => p[0]).slice(0, 2).join("")}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground leading-tight">{name}</p>
                      {role && <p className="text-xs text-muted-foreground leading-tight mt-0.5">{role}</p>}
                    </div>
                  </div>
                </motion.div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
