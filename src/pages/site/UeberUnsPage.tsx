import { useEffect, useState, useRef } from "react";
import { useLocation, Link } from "react-router-dom";
import { ScrollReveal } from "@/components/site/ScrollReveal";
import { Shield, Zap, Leaf, MapPin, Phone, Mail, Clock, Quote, Cpu, ArrowRight } from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Timeline } from "@/components/site/Timeline";
import werkstatt from "@/assets/werkstatt.jpg";
import Seo from "@/components/site/Seo";

const values = [
  { icon: Shield, title: "Qualität", desc: "Jeder Druck durchläuft strenge Qualitätskontrolle. Wir liefern nur, was uns selbst überzeugt." },
  { icon: Zap, title: "Schnelligkeit", desc: "48h von Bestellung bis Lieferung. Express-Optionen für eilige Projekte verfügbar." },
  { icon: Leaf, title: "Nachhaltigkeit", desc: "Recycelbare Materialien, energieeffiziente Drucker. Weniger Abfall, mehr Zukunft." },
];

interface TeamMember {
  id: string;
  name: string;
  role: string | null;
  bio: string | null;
  photo_path: string | null;
}

const photoUrl = (p: string | null) =>
  p ? supabase.storage.from("team-photos").getPublicUrl(p).data.publicUrl : "";

export default function UeberUnsPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [storyImage, setStoryImage] = useState<string>(werkstatt);
  const location = useLocation();

  useEffect(() => {
    supabase
      .from("team_members")
      .select("id, name, role, bio, photo_path")
      .eq("aktiv", true)
      .order("sort_order")
      .then(({ data }) => { if (data) setTeam(data as TeamMember[]); });

    supabase
      .from("website_settings")
      .select("value")
      .eq("key", "ueber_uns_bild")
      .maybeSingle()
      .then(({ data }) => {
        const url = (data?.value as any)?.url;
        if (url) setStoryImage(url);
      });
  }, []);

  // Smooth scroll to hash anchors when navigating from header dropdown
  useEffect(() => {
    if (location.hash) {
      const id = location.hash.slice(1);
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 200);
    }
  }, [location.hash, team.length]);

  return (
    <div className="pb-16">
      <Seo
        title="Über uns – 3DMuscio, Ihr 3D Druck Partner in der Schweiz"
        description="3DMuscio aus Eschlikon TG: Geschichte, Team und Standort. Ihr Partner für FDM und SLA 3D Druck, Prototypen, Kleinserien und Ersatzteile in der Schweiz."
        path="/ueber-uns"
      />
      <div className="container mx-auto px-4">
        {/* Hero */}
        <div ref={heroRef} className="mb-16 md:mb-24 pt-12">
          <motion.div style={{ y: heroY }}>
            <ScrollReveal>
              <div className="max-w-xl">
                <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">Über uns</p>
                <h1 className="font-heading text-3xl md:text-5xl font-extrabold text-foreground tracking-tight mb-4">
                  Wir machen 3D-Druck<br />zugänglich.
                </h1>
                <p className="text-muted-foreground text-base leading-relaxed">
                  Schweizer Qualität trifft modernste Technologie — seit 2021.
                </p>
              </div>
            </ScrollReveal>
          </motion.div>
        </div>

        {/* Timeline (mit Team als Heute-Knoten) */}
        <div id="zeitleiste" className="scroll-mt-24">
          <Timeline team={team} />
        </div>

        {/* Story */}
        <ScrollReveal>
          <div id="geschichte" className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-20 md:mb-28 max-w-5xl mx-auto scroll-mt-24">
            <div className="md:col-span-5">
              <img
                src={storyImage}
                alt="Unsere Werkstatt mit 3D-Druckern"
                className="rounded-xl aspect-[3/4] object-cover w-full md:sticky md:top-24"
              />
            </div>
            <div className="md:col-span-7 md:pl-4">
              <span className="text-xs font-bold text-muted-foreground tracking-widest block mb-6">UNSERE GESCHICHTE</span>
              <h2 className="font-heading text-2xl font-bold text-foreground mb-6 tracking-tight">
                Von einem Drucker zu einer Flotte.
              </h2>
              <div className="space-y-5 text-muted-foreground text-sm leading-relaxed">
                <p>
                  2021 starteten wir mit einem einzigen FDM-Drucker und einer einfachen Idee: professionellen 3D-Druck
                  für alle zugänglich machen — ohne Mindestbestellmengen, ohne komplizierte Prozesse.
                </p>
                <p>
                  Heute betreiben wir eine wachsende Flotte aus FDM- und SLA-Druckern in der Schweiz. Jeder Auftrag
                  wird von unserem Team persönlich betreut — von der Dateiprüfung bis zur Endkontrolle.
                </p>
                <p>
                  Unser Fokus liegt auf Geschwindigkeit und Qualität. 48 Stunden Lieferzeit ist kein Marketing —
                  es ist unser Standard.
                </p>
              </div>
            </div>
          </div>
        </ScrollReveal>

        {/* Team – ausführlich */}
        {team.length > 0 && (
          <div id="team" className="mb-20 md:mb-28 scroll-mt-24">
            <ScrollReveal>
              <div className="mb-10">
                <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">Das Team</p>
                <h2 className="font-heading text-3xl font-bold text-foreground tracking-tight">
                  {team.length === 1 ? "Lerne uns kennen." : "Die Köpfe hinter dem Druck."}
                </h2>
              </div>
            </ScrollReveal>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {team.map((m, i) => {
                const photo = photoUrl(m.photo_path);
                return (
                  <ScrollReveal key={m.id} delay={i * 0.08}>
                    <motion.div
                      className="bg-card rounded-xl border border-border p-6 md:p-8 flex flex-col sm:flex-row gap-6 items-start h-full"
                      whileHover={{ y: -2 }}
                    >
                      {photo ? (
                        <img
                          src={photo}
                          alt={m.name}
                          className="flex-shrink-0 w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border-2 border-border shadow-md"
                        />
                      ) : (
                        <div className="flex-shrink-0 w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-primary/10 border-2 border-border flex items-center justify-center">
                          <span className="text-3xl font-heading font-black text-primary">{m.name[0]}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-heading text-xl font-bold text-foreground mb-0.5">{m.name}</h3>
                        {m.role && (
                          <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">{m.role}</p>
                        )}
                        {m.bio && (
                          <div className="relative">
                            <Quote className="w-5 h-5 text-primary/30 absolute -top-1 -left-1" />
                            <p className="text-muted-foreground text-sm leading-relaxed pl-5">{m.bio}</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </ScrollReveal>
                );
              })}
            </div>
          </div>
        )}

        {/* Maschinen-Banner */}
        <ScrollReveal>
          <motion.div
            whileHover={{ y: -2 }}
            transition={{ duration: 0.3 }}
            className="mb-20 md:mb-28 rounded-2xl border border-primary/30 bg-gradient-to-r from-card via-card to-primary/10 px-5 py-5 md:px-8 md:py-6 flex flex-col sm:flex-row items-start sm:items-center gap-5 shadow-sm hover:shadow-md hover:border-primary/50 transition-all"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
              <Cpu className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-heading text-base md:text-lg font-bold text-foreground">Neugierig auf unsere Technologie?</h3>
              <p className="text-sm text-muted-foreground">Entdecke die Maschinen hinter deinen Drucken</p>
            </div>
            <Link
              to="/maschinen"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors flex-shrink-0"
            >
              Unsere Maschinen <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </ScrollReveal>

        {/* Values */}
        <div className="mb-20 md:mb-28">
          <ScrollReveal>
            <div className="mb-10">
              <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">Werte</p>
              <h2 className="font-heading text-3xl font-bold text-foreground tracking-tight">
                Wofür wir stehen.
              </h2>
            </div>
          </ScrollReveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {values.map((v, i) => (
              <ScrollReveal key={i} delay={i * 0.08}>
                <motion.div
                  className="bg-card rounded-xl p-6 border border-border hover:border-primary/30 transition-colors h-full"
                  whileHover={{ y: -2 }}
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <v.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-heading text-base font-bold text-foreground mb-2">{v.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{v.desc}</p>
                </motion.div>
              </ScrollReveal>
            ))}
          </div>
        </div>

        {/* Standort */}
        <ScrollReveal>
          <div id="standort" className="bg-card rounded-xl border border-border p-6 md:p-8 max-w-3xl scroll-mt-24">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-primary" />
              </div>
              <h2 className="font-heading text-lg font-bold text-foreground">Standort</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5" /> Gartensiedlung 13, 8360 Eschlikon TG</span>
              <span className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" /> +41 79 839 50 80</span>
              <span className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" /> info@3dmuscio.com</span>
              <span className="flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> Mo–Fr: 08:00–18:00</span>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
}
