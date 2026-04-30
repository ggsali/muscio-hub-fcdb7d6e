import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { ScrollReveal } from "./ScrollReveal";
import * as Icons from "lucide-react";
import { Sparkles, Users } from "lucide-react";

interface TimelineEvent {
  id: string;
  jahr: string;
  titel: string;
  beschreibung: string | null;
  icon: string | null;
}

interface TeamMini {
  id: string;
  name: string;
  role: string | null;
  photo_path: string | null;
}

function getIcon(name: string | null) {
  if (!name) return Sparkles;
  const Icon = (Icons as any)[name];
  return Icon || Sparkles;
}

const photoUrl = (p: string | null) =>
  p ? supabase.storage.from("team-photos").getPublicUrl(p).data.publicUrl : "";

interface TimelineProps {
  team?: TeamMini[];
}

export function Timeline({ team = [] }: TimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);

  useEffect(() => {
    supabase
      .from("timeline_events")
      .select("id, jahr, titel, beschreibung, icon")
      .eq("aktiv", true)
      .order("sort_order")
      .then(({ data }) => { if (data) setEvents(data as TimelineEvent[]); });
  }, []);

  if (events.length === 0 && team.length === 0) return null;

  // Append "Heute" team card as final timeline node
  const totalNodes = events.length + (team.length > 0 ? 1 : 0);

  return (
    <div className="mb-20 md:mb-28">
      <ScrollReveal>
        <div className="mb-10">
          <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">Unsere Reise</p>
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground tracking-tight">
            Wie alles begann.
          </h2>
        </div>
      </ScrollReveal>

      <div className="relative max-w-3xl mx-auto md:mx-0 md:max-w-none">
        {/* Vertical line */}
        <div className="absolute left-4 md:left-1/2 top-2 bottom-2 w-px bg-gradient-to-b from-primary/40 via-border to-primary/40 md:-translate-x-px" />

        <div className="space-y-8">
          {events.map((e, i) => {
            const Icon = getIcon(e.icon);
            const isLeft = i % 2 === 0;
            return (
              <ScrollReveal key={e.id} delay={i * 0.05}>
                <div className={`relative flex items-start gap-4 md:gap-0 ${isLeft ? "md:flex-row" : "md:flex-row-reverse"}`}>
                  <div className="absolute left-4 md:left-1/2 -translate-x-1/2 z-10 flex items-center justify-center">
                    <motion.div
                      whileInView={{ scale: [0.6, 1.15, 1] }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5 }}
                      className="w-9 h-9 rounded-full bg-background border-2 border-primary flex items-center justify-center shadow-md"
                    >
                      <Icon className="w-4 h-4 text-primary" />
                    </motion.div>
                  </div>
                  <div className="hidden md:block md:w-1/2" />
                  <div className={`pl-14 md:pl-0 md:w-1/2 ${isLeft ? "md:pr-10 md:text-right" : "md:pl-10"}`}>
                    <motion.div
                      whileHover={{ y: -2 }}
                      className="inline-block w-full bg-card border border-border rounded-xl p-5 hover:border-primary/40 transition-colors"
                    >
                      <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">{e.jahr}</p>
                      <h3 className="font-heading text-lg font-bold text-foreground mb-1.5">{e.titel}</h3>
                      {e.beschreibung && (
                        <p className="text-sm text-muted-foreground leading-relaxed">{e.beschreibung}</p>
                      )}
                    </motion.div>
                  </div>
                </div>
              </ScrollReveal>
            );
          })}

          {/* Heute / Team-Knoten */}
          {team.length > 0 && (() => {
            const isLeft = events.length % 2 === 0;
            return (
              <ScrollReveal delay={Math.min(totalNodes * 0.05, 0.4)}>
                <div className={`relative flex items-start gap-4 md:gap-0 ${isLeft ? "md:flex-row" : "md:flex-row-reverse"}`}>
                  <div className="absolute left-4 md:left-1/2 -translate-x-1/2 z-10 flex items-center justify-center">
                    <motion.div
                      whileInView={{ scale: [0.6, 1.15, 1] }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5 }}
                      className="w-10 h-10 rounded-full bg-primary border-2 border-primary flex items-center justify-center shadow-lg shadow-primary/30"
                    >
                      <Users className="w-4 h-4 text-primary-foreground" />
                    </motion.div>
                  </div>
                  <div className="hidden md:block md:w-1/2" />
                  <div className={`pl-14 md:pl-0 md:w-1/2 ${isLeft ? "md:pr-10 md:text-right" : "md:pl-10"}`}>
                    <motion.div
                      whileHover={{ y: -2 }}
                      className="inline-block w-full bg-gradient-to-br from-primary/[0.10] to-card border border-primary/30 rounded-xl p-5"
                    >
                      <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">Heute</p>
                      <h3 className="font-heading text-lg font-bold text-foreground mb-3">
                        {team.length === 1 ? "Das Gesicht hinter 3DMuscio" : `${team.length}-köpfiges Team`}
                      </h3>
                      <div className={`flex -space-x-2 mb-2 ${isLeft ? "md:justify-end" : ""}`}>
                        {team.slice(0, 6).map((m) => {
                          const url = photoUrl(m.photo_path);
                          return url ? (
                            <img
                              key={m.id}
                              src={url}
                              alt={m.name}
                              title={m.name}
                              className="w-10 h-10 rounded-full object-cover border-2 border-card"
                            />
                          ) : (
                            <div
                              key={m.id}
                              title={m.name}
                              className="w-10 h-10 rounded-full bg-primary/15 border-2 border-card flex items-center justify-center text-primary text-xs font-bold"
                            >
                              {m.name[0]}
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Mit Leidenschaft und Schweizer Präzision für jeden Auftrag.
                      </p>
                    </motion.div>
                  </div>
                </div>
              </ScrollReveal>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
