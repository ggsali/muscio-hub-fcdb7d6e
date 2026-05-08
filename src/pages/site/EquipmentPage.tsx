import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Cpu, Loader2 } from "lucide-react";
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
  model_rotation?: { x: number; y: number; z: number } | null;
}

export default function EquipmentPage() {
  const [items, setItems] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (supabase.from as any)("equipment")
      .select("*").eq("aktiv", true).order("sort_order")
      .then(({ data }: any) => {
        setItems((data as Equipment[]) || []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="pb-16">
      <div className="container mx-auto px-4">
        {/* Hero */}
        <div className="mb-16 md:mb-24 pt-12">
          <ScrollReveal>
            <div className="max-w-xl">
              <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">Unsere Technologie</p>
              <h1 className="font-heading text-3xl md:text-5xl font-extrabold text-foreground tracking-tight mb-4">
                Unsere Maschinen.
              </h1>
              <p className="text-muted-foreground text-base leading-relaxed">
                Die Drucker und Geräte, mit denen wir deine Projekte realisieren — interaktiv erkundbar.
              </p>
            </div>
          </ScrollReveal>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        )}

        {/* Empty */}
        {!loading && items.length === 0 && (
          <div className="text-center py-20">
            <Cpu className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Bald verfügbar.</p>
          </div>
        )}

        {/* Items */}
        {!loading && items.length > 0 && (
          <div className="mb-20 md:mb-28">
            {items.map((it, i) => {
              const reversed = i % 2 === 1;
              return (
                <ScrollReveal key={it.id}>
                  <div className="grid grid-cols-1 md:grid-cols-10 gap-6 md:gap-8 items-stretch border-b border-border py-10 md:py-16">
                    {/* Viewer / Bild */}
                    <div className={`md:col-span-6 ${reversed ? "md:order-2" : ""}`}>
                      <div className="rounded-xl overflow-hidden h-[280px] md:h-auto md:min-h-[400px] md:flex md:items-center md:justify-center" style={{ background: "transparent" }}>
                        {it.modell_url ? (
                          <ModelViewer url={it.modell_url} rotation={it.model_rotation || undefined} />
                        ) : it.vorschaubild_url ? (
                          <img src={it.vorschaubild_url} alt={it.name} className="w-full h-full object-cover" />
                        ) : (
                          <Cpu className="w-12 h-12 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Infos */}
                    <div className="md:col-span-4 flex flex-col justify-center p-1 md:p-8">
                      <p className="text-xs font-medium text-primary uppercase tracking-widest mb-2 md:mb-3">
                        Maschine {String(i + 1).padStart(2, "0")}
                      </p>
                      <h2 className="font-heading text-2xl md:text-4xl font-extrabold text-foreground tracking-tight mb-3 md:mb-4">
                        {it.name}
                      </h2>
                      {it.beschreibung && (
                        <p className="text-muted-foreground text-sm md:text-base leading-relaxed mb-4 md:mb-6 whitespace-pre-wrap">
                          {it.beschreibung}
                        </p>
                      )}
                      {Array.isArray(it.specs) && it.specs.length > 0 && (
                        <dl className="divide-y divide-border border-t border-border">
                          {it.specs.map((s, idx) => (
                            <div key={idx} className="flex justify-between items-center py-2 md:py-3">
                              <dt className="text-xs md:text-sm text-muted-foreground">{s.key}</dt>
                              <dd className="text-xs md:text-sm font-medium text-foreground text-right">{s.value}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </div>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        )}

        {/* CTA */}
        <ScrollReveal>
          <div className="rounded-2xl px-6 py-14 md:px-12 md:py-20 text-center">
            <h2 className="font-heading text-3xl md:text-4xl font-extrabold text-foreground tracking-tight mb-3">
              Bereit für dein Projekt?
            </h2>
            <p className="text-muted-foreground text-base mb-8 max-w-lg mx-auto">
              Lass uns gemeinsam etwas Grossartiges erschaffen.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/kalkulator-online"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                Offerte anfragen <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/kontakt"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-border text-foreground text-sm font-semibold hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                Kontakt aufnehmen
              </Link>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
}
