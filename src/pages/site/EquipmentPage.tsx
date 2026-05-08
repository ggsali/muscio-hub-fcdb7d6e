import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Cpu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ModelViewer from "@/components/site/ModelViewer";
import { ScrollReveal } from "@/components/site/ScrollReveal";

interface Spec { key: string; value: string; }
interface Equipment {
  id: string;
  name: string;
  beschreibung: string | null;
  specs: Spec[] | null;
  modell_url: string | null;
  vorschaubild_url: string | null;
}

export default function EquipmentPage() {
  const [items, setItems] = useState<Equipment[]>([]);

  useEffect(() => {
    (supabase.from as any)("equipment")
      .select("*").eq("aktiv", true).order("sort_order")
      .then(({ data }: any) => setItems((data as Equipment[]) || []));
  }, []);

  return (
    <div className="pb-20">
      <div className="container mx-auto px-4">
        {/* Hero */}
        <ScrollReveal>
          <div className="max-w-2xl pt-12 mb-16 md:mb-24">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-muted/40 text-xs text-muted-foreground mb-4">
              <Cpu className="w-3.5 h-3.5 text-primary" /> Unsere Technologie
            </div>
            <h1 className="font-heading text-4xl md:text-5xl font-extrabold text-foreground tracking-tight mb-4">
              Unsere Maschinen.
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed">
              Eine Auswahl der Drucker und Geräte, mit denen wir deine Projekte realisieren — interaktiv erkundbar.
            </p>
          </div>
        </ScrollReveal>

        {/* Items */}
        <div className="space-y-24 md:space-y-32">
          {items.map((it, i) => {
            const reversed = i % 2 === 1;
            return (
              <div key={it.id} className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
                <motion.div
                  initial={{ opacity: 0, x: reversed ? 40 : -40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  className={`md:col-span-6 ${reversed ? "md:order-2" : ""}`}
                >
                  <div className="rounded-2xl overflow-hidden border border-border bg-card aspect-square">
                    {it.modell_url ? (
                      <ModelViewer url={it.modell_url} />
                    ) : it.vorschaubild_url ? (
                      <img src={it.vorschaubild_url} alt={it.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Cpu className="w-10 h-10" /></div>
                    )}
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: reversed ? -40 : 40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
                  className="md:col-span-6"
                >
                  <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">Maschine {String(i + 1).padStart(2, "0")}</p>
                  <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground tracking-tight mb-4">{it.name}</h2>
                  {it.beschreibung && (
                    <p className="text-muted-foreground text-sm leading-relaxed mb-6 whitespace-pre-wrap">{it.beschreibung}</p>
                  )}
                  {Array.isArray(it.specs) && it.specs.length > 0 && (
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 border-t border-border pt-5">
                      {it.specs.map((s, idx) => (
                        <div key={idx} className="flex flex-col">
                          <dt className="text-xs uppercase tracking-widest text-muted-foreground">{s.key}</dt>
                          <dd className="text-sm font-medium text-foreground">{s.value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </motion.div>
              </div>
            );
          })}

          {items.length === 0 && (
            <p className="text-center text-muted-foreground py-12">Noch keine Maschinen veröffentlicht.</p>
          )}
        </div>

        {/* CTA */}
        <ScrollReveal>
          <div className="mt-24 md:mt-32 bg-card border border-border rounded-2xl p-10 md:p-14 text-center max-w-3xl mx-auto">
            <h2 className="font-heading text-2xl md:text-3xl font-bold tracking-tight mb-3">Bereit für dein Projekt?</h2>
            <p className="text-muted-foreground text-sm mb-6">Lade dein Modell hoch und erhalte sofort eine Preisschätzung.</p>
            <Link
              to="/kalkulator-online"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              Projekt starten <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
}
