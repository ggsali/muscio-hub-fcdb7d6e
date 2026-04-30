import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, useScroll, useTransform } from "framer-motion";
import { ScrollReveal } from "./ScrollReveal";
import * as Icons from "lucide-react";
import { Sparkles, Users } from "lucide-react";

interface TimelineEvent {
  id: string;
  jahr: string;
  titel: string;
  beschreibung: string | null;
  icon: string | null;
  image_path: string | null;
}

interface TeamMini {
  id: string;
  name: string;
  role: string | null;
  photo_path: string | null;
}

function getIcon(name: string | null) {
  if (!name) return Sparkles;
  return (Icons as any)[name] || Sparkles;
}

const eventImageUrl = (p: string | null) =>
  p ? supabase.storage.from("timeline-images").getPublicUrl(p).data.publicUrl : "";

const teamPhotoUrl = (p: string | null) =>
  p ? supabase.storage.from("team-photos").getPublicUrl(p).data.publicUrl : "";

interface TimelineProps {
  team?: TeamMini[];
}

function TimelineItem({
  event, index, isLeft, total,
}: { event: TimelineEvent; index: number; isLeft: boolean; total: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const Icon = getIcon(event.icon);
  const img = eventImageUrl(event.image_path);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 90%", "end 30%"],
  });
  const opacity = useTransform(scrollYProgress, [0, 0.25, 1], [0, 1, 1]);
  const y = useTransform(scrollYProgress, [0, 0.4], [40, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.4], [0.85, 1]);
  const rotate = useTransform(scrollYProgress, [0, 0.4], [isLeft ? -3 : 3, 0]);
  const dotScale = useTransform(scrollYProgress, [0, 0.2, 0.4], [0.4, 1.3, 1]);

  return (
    <div ref={ref} className={`relative flex items-start gap-4 md:gap-0 ${isLeft ? "md:flex-row" : "md:flex-row-reverse"}`}>
      {/* Dot */}
      <div className="absolute left-4 md:left-1/2 -translate-x-1/2 z-10 flex items-center justify-center">
        <motion.div
          style={{ scale: dotScale }}
          className="w-9 h-9 rounded-full bg-background border-2 border-primary flex items-center justify-center shadow-lg shadow-primary/20"
        >
          <Icon className="w-4 h-4 text-primary" />
        </motion.div>
      </div>

      <div className="hidden md:block md:w-1/2" />

      <motion.div
        style={{ opacity, y, scale, rotate }}
        className={`pl-14 md:pl-0 md:w-1/2 ${isLeft ? "md:pr-10 md:text-right" : "md:pl-10"}`}
      >
        <div className="inline-block w-full bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/40 transition-colors group">
          {img && (
            <div className="aspect-[16/10] overflow-hidden bg-muted">
              <img
                src={img}
                alt={event.titel}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
            </div>
          )}
          <div className="p-5">
            <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">{event.jahr}</p>
            <h3 className="font-heading text-lg font-bold text-foreground mb-1.5">{event.titel}</h3>
            {event.beschreibung && (
              <p className="text-sm text-muted-foreground leading-relaxed">{event.beschreibung}</p>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function HeuteItem({ team, isLeft }: { team: TeamMini[]; isLeft: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 90%", "end 30%"],
  });
  const opacity = useTransform(scrollYProgress, [0, 0.3, 1], [0, 1, 1]);
  const y = useTransform(scrollYProgress, [0, 0.4], [40, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.4], [0.85, 1]);

  return (
    <div ref={ref} className={`relative flex items-start gap-4 md:gap-0 ${isLeft ? "md:flex-row" : "md:flex-row-reverse"}`}>
      <div className="absolute left-4 md:left-1/2 -translate-x-1/2 z-10 flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.4 }}
          whileInView={{ scale: [0.4, 1.3, 1] }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="w-10 h-10 rounded-full bg-primary border-2 border-primary flex items-center justify-center shadow-lg shadow-primary/40"
        >
          <Users className="w-4 h-4 text-primary-foreground" />
        </motion.div>
      </div>
      <div className="hidden md:block md:w-1/2" />
      <motion.div
        style={{ opacity, y, scale }}
        className={`pl-14 md:pl-0 md:w-1/2 ${isLeft ? "md:pr-10 md:text-right" : "md:pl-10"}`}
      >
        <div className="inline-block w-full bg-gradient-to-br from-primary/[0.10] to-card border border-primary/30 rounded-2xl p-5">
          <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">Heute</p>
          <h3 className="font-heading text-lg font-bold text-foreground mb-3">
            {team.length === 1 ? "Das Gesicht hinter 3DMuscio" : `Unser ${team.length}-köpfiges Team`}
          </h3>
          <div className={`flex flex-wrap gap-2 mb-3 ${isLeft ? "md:justify-end" : ""}`}>
            {team.slice(0, 8).map((m, i) => {
              const url = teamPhotoUrl(m.photo_path);
              return (
                <motion.div
                  key={m.id}
                  initial={{ scale: 0, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 + i * 0.08, type: "spring", stiffness: 220, damping: 18 }}
                  className="flex flex-col items-center gap-1"
                >
                  {url ? (
                    <img
                      src={url}
                      alt={m.name}
                      title={m.name}
                      className="w-12 h-12 rounded-full object-cover border-2 border-card shadow-md"
                    />
                  ) : (
                    <div
                      title={m.name}
                      className="w-12 h-12 rounded-full bg-primary/15 border-2 border-card flex items-center justify-center text-primary text-sm font-bold shadow-md"
                    >
                      {m.name[0]}
                    </div>
                  )}
                  <span className="text-[10px] text-muted-foreground font-medium leading-none">
                    {m.name.split(" ")[0]}
                  </span>
                </motion.div>
              );
            })}
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Mit Leidenschaft und Schweizer Präzision für jeden Auftrag.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export function Timeline({ team = [] }: TimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress: lineProgress } = useScroll({
    target: containerRef,
    offset: ["start 60%", "end 60%"],
  });
  const lineHeight = useTransform(lineProgress, [0, 1], ["0%", "100%"]);

  useEffect(() => {
    supabase
      .from("timeline_events")
      .select("id, jahr, titel, beschreibung, icon, image_path")
      .eq("aktiv", true)
      .order("sort_order")
      .then(({ data }) => { if (data) setEvents(data as TimelineEvent[]); });
  }, []);

  if (events.length === 0 && team.length === 0) return null;

  return (
    <div className="mb-20 md:mb-28">
      <ScrollReveal>
        <div className="mb-10">
          <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">Unsere Reise</p>
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground tracking-tight">
            Wie alles begann.
          </h2>
          <p className="text-sm text-muted-foreground mt-2">Scrolle dich durch unsere Geschichte.</p>
        </div>
      </ScrollReveal>

      <div ref={containerRef} className="relative max-w-3xl mx-auto md:mx-0 md:max-w-none">
        {/* Background line */}
        <div className="absolute left-4 md:left-1/2 top-2 bottom-2 w-px bg-border md:-translate-x-px" />
        {/* Animated progress line */}
        <motion.div
          style={{ height: lineHeight }}
          className="absolute left-4 md:left-1/2 top-2 w-px bg-gradient-to-b from-primary via-primary to-primary/40 md:-translate-x-px shadow-[0_0_8px_hsl(var(--primary)/0.5)]"
        />

        <div className="space-y-12 md:space-y-16">
          {events.map((e, i) => (
            <TimelineItem key={e.id} event={e} index={i} isLeft={i % 2 === 0} total={events.length} />
          ))}
          {team.length > 0 && (
            <HeuteItem team={team} isLeft={events.length % 2 === 0} />
          )}
        </div>
      </div>
    </div>
  );
}
