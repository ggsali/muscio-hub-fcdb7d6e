import { Link } from "react-router-dom";
import { ScrollReveal } from "@/components/ScrollReveal";
import { CountUp } from "@/components/CountUp";
import { Marquee } from "@/components/Marquee";
import {
  Upload, Settings, ShoppingCart, Package, Star,
  Clock, Target, Layers, Users, ArrowRight, ArrowUpRight,
} from "lucide-react";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Button } from "@/components/ui/button";

/* ─── HERO ─── */
const Hero = () => {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const cubeY = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const gridOpacity = useTransform(scrollYProgress, [0, 0.5], [0.04, 0.01]);

  return (
    <section ref={ref} className="relative min-h-[92vh] flex items-center overflow-hidden">
      <div className="absolute inset-0 bg-[#0a0a0a]" />
      <motion.div
        className="absolute inset-0"
        style={{
          opacity: gridOpacity,
          backgroundImage: "linear-gradient(hsl(0 0% 6%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 6%) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />
      <motion.div className="absolute right-[6%] top-[40%] hidden lg:block" style={{ y: cubeY, opacity }}>
        <div className="cube-scene opacity-30">
          <div className="cube">
            {[...Array(6)].map((_, i) => <div key={i} className="cube-face" />)}
          </div>
        </div>
      </motion.div>
      <motion.div className="absolute right-[5%] bottom-[10%] hidden lg:block select-none pointer-events-none"
        style={{ y: useTransform(scrollYProgress, [0, 1], [0, 60]) }}>
        <span className="text-[12rem] font-extrabold text-white/[0.02] leading-none tracking-tighter">3D</span>
      </motion.div>

      <motion.div className="container mx-auto px-4 relative z-10" style={{ y, opacity }}>
        <div className="max-w-2xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 text-xs font-medium text-white/50 mb-8 tracking-wide uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00cc66]" />
              3D-Druck aus der Schweiz
            </div>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-[clamp(2.5rem,7vw,5rem)] font-extrabold leading-[1.02] mb-6 text-white tracking-tight"
          >
            Dein Design.<br />Gedruckt.<br /><span className="text-[#00cc66]">Perfekt.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.25 }}
            className="text-base text-white/50 mb-10 leading-relaxed max-w-sm">
            Von der Idee zum fertigen Teil in 48h. Präzise, zuverlässig, bezahlbar.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.35 }}
            className="flex flex-col sm:flex-row gap-3">
            <Button size="lg" asChild className="bg-[#00cc66] hover:bg-[#00aa55] text-black font-semibold">
              <Link to="/kalkulator">Preis berechnen <ArrowRight className="w-4 h-4 ml-1" /></Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="border-white/10 text-white hover:bg-white/5">
              <Link to="/materialien">Materialien</Link>
            </Button>
          </motion.div>
        </div>
      </motion.div>

      <motion.div className="absolute bottom-8 left-1/2 -translate-x-1/2"
        animate={{ y: [0, 8, 0] }} transition={{ duration: 2, repeat: Infinity }}>
        <div className="w-5 h-8 rounded-full border-2 border-white/20 flex items-start justify-center p-1">
          <motion.div className="w-1 h-2 rounded-full bg-white/30"
            animate={{ y: [0, 10, 0] }} transition={{ duration: 2, repeat: Infinity }} />
        </div>
      </motion.div>
    </section>
  );
};

const stats = [
  { icon: Clock, value: 48, suffix: "h", label: "Lieferzeit" },
  { icon: Target, value: 0.1, suffix: "mm", label: "Präzision", decimals: 1 },
  { icon: Layers, value: 12, suffix: "+", label: "Materialien" },
  { icon: Users, value: 500, suffix: "+", label: "Zufriedene Kunden" },
];

const Stats = () => (
  <section className="py-20 bg-[#0a0a0a]">
    <div className="container mx-auto px-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-12">
        {stats.map((s, i) => (
          <ScrollReveal key={i} delay={i * 0.08}>
            <div className="relative">
              <span className="text-[3rem] font-extrabold text-white/[0.03] absolute -top-4 -left-2 leading-none select-none">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="relative">
                <div className="w-10 h-10 rounded-lg bg-[#00cc66]/10 flex items-center justify-center mb-3">
                  <s.icon className="w-4 h-4 text-[#00cc66]" />
                </div>
                <div className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
                  <CountUp end={s.value} suffix={s.suffix} decimals={s.decimals || 0} />
                </div>
                <p className="text-white/40 mt-1 text-xs uppercase tracking-widest">{s.label}</p>
              </div>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </div>
  </section>
);

const steps = [
  { icon: Upload, title: "Hochladen", desc: "3D-Modell als STL, OBJ, STEP oder 3MF hochladen." },
  { icon: Settings, title: "Konfigurieren", desc: "Material, Farbe, Schichthöhe und Fülldichte wählen." },
  { icon: ShoppingCart, title: "Bestellen", desc: "Sofort deinen Preis erhalten und Bestellung absenden." },
  { icon: Package, title: "Erhalten", desc: "Wir drucken, prüfen und liefern innerhalb von 48h." },
];

const HowItWorks = () => {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const lineHeight = useTransform(scrollYProgress, [0.1, 0.7], ["0%", "100%"]);
  return (
    <section ref={ref} className="py-28 relative bg-[#0a0a0a]">
      <div className="container mx-auto px-4">
        <ScrollReveal>
          <div className="mb-16 max-w-md">
            <p className="text-xs font-medium text-[#00cc66] uppercase tracking-widest mb-3">Prozess</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Vier Schritte.<br />Ein Ergebnis.</h2>
          </div>
        </ScrollReveal>
        <div className="relative max-w-3xl">
          <div className="absolute left-[19px] top-0 bottom-0 w-px bg-white/10 hidden md:block">
            <motion.div className="w-full bg-[#00cc66] origin-top" style={{ height: lineHeight }} />
          </div>
          <div className="space-y-8 md:space-y-12">
            {steps.map((step, i) => (
              <ScrollReveal key={i} delay={i * 0.08}>
                <div className="flex gap-6 md:gap-8 items-start group">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg border border-white/10 bg-[#111] flex items-center justify-center relative z-10 group-hover:border-[#00cc66] group-hover:bg-[#00cc66]/5 transition-colors">
                    <step.icon className="w-4 h-4 text-white/40 group-hover:text-[#00cc66] transition-colors" />
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-baseline gap-3 mb-1">
                      <span className="text-[10px] font-bold text-white/30 tracking-widest">{String(i + 1).padStart(2, "0")}</span>
                      <h3 className="text-lg font-bold text-white">{step.title}</h3>
                    </div>
                    <p className="text-white/40 text-sm leading-relaxed ml-[calc(10px+0.75rem)]">{step.desc}</p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const materialTeaser = [
  { name: "PLA", price: "0.04", tag: "FDM", desc: "Bio-abbaubar, ideal für Prototypen" },
  { name: "PETG", price: "0.06", tag: "FDM", desc: "Stark, chemisch beständig" },
  { name: "ABS", price: "0.05", tag: "FDM", desc: "Hitzebeständig, industrietauglich" },
  { name: "Resin", price: "0.12", tag: "SLA", desc: "Höchste Detailgenauigkeit" },
];

const MaterialsTeaser = () => {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const x = useTransform(scrollYProgress, [0, 1], [40, -40]);
  return (
    <section ref={ref} className="py-24 bg-white overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-xs font-medium text-[#00cc66] uppercase tracking-widest mb-3">Materialien</p>
            <h2 className="text-3xl md:text-4xl font-bold text-[#0a0a0a] tracking-tight">Für jeden Einsatz das<br className="hidden md:block" /> richtige Material.</h2>
          </div>
          <Link to="/materialien" className="hidden md:flex items-center gap-1 text-sm font-medium text-[#00cc66] hover:underline underline-offset-4">
            Alle ansehen <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" style={{ x }}>
          {materialTeaser.map((m, i) => (
            <motion.div key={i} className="rounded-xl p-5 border border-[#0a0a0a]/10 hover:border-[#00cc66]/40 bg-[#0a0a0a]/5 transition-colors group" whileHover={{ y: -3 }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold text-[#0a0a0a]">{m.name}</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#0a0a0a]/10 tracking-wider text-[#0a0a0a]">{m.tag}</span>
              </div>
              <p className="text-[#0a0a0a]/60 text-sm mb-4">{m.desc}</p>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[#0a0a0a]">CHF {m.price}/g</span>
                <span className="text-xs text-[#00cc66] font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  Details <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

const testimonials = [
  { name: "Michael B.", role: "Maschinenbau-Ingenieur", quote: "Hervorragende Qualität und blitzschnelle Lieferung. Unsere Prototypen waren perfekt.", stars: 5 },
  { name: "Laura S.", role: "Produktdesignerin", quote: "Der Kalkulator ist genial. Sofort den Preis wissen und direkt bestellen.", stars: 5 },
  { name: "David K.", role: "Hobby-Maker", quote: "Die Materialauswahl ist top und die Beratung immer hilfreich und schnell.", stars: 4 },
];

const Testimonials = () => (
  <section className="py-28 bg-[#0a0a0a]">
    <div className="container mx-auto px-4">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8">
        <div className="md:col-span-4 flex flex-col justify-center">
          <ScrollReveal>
            <p className="text-xs font-medium text-[#00cc66] uppercase tracking-widest mb-3">Feedback</p>
            <h2 className="text-3xl font-bold text-white tracking-tight mb-4">Was unsere Kunden sagen.</h2>
            <p className="text-white/40 text-sm leading-relaxed">Über 500 zufriedene Kunden vertrauen auf unseren Service.</p>
          </ScrollReveal>
        </div>
        <div className="md:col-span-8 space-y-4">
          {testimonials.map((t, i) => (
            <ScrollReveal key={i} delay={i * 0.1}>
              <div className={`bg-[#111] rounded-xl p-6 border border-white/8 ${i === 1 ? "md:ml-12" : i === 2 ? "md:ml-6" : ""}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-xs font-bold text-white/50">
                      {t.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-white">{t.name}</p>
                      <p className="text-white/40 text-xs">{t.role}</p>
                    </div>
                  </div>
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} className={`w-3.5 h-3.5 ${j < t.stars ? "fill-[#00cc66] text-[#00cc66]" : "text-white/10"}`} />
                    ))}
                  </div>
                </div>
                <p className="text-white/60 text-sm leading-relaxed">"{t.quote}"</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </div>
  </section>
);

const faqItems = [
  { q: "Welche Dateiformate werden akzeptiert?", a: "STL, OBJ, STEP und 3MF bis 500MB." },
  { q: "Wie lange dauert die Lieferung?", a: "Standard: 48 Stunden. Express auf Anfrage." },
  { q: "Gibt es Mengenrabatte?", a: "Ab 5 Stück 10%, ab 10 Stück 15% Rabatt." },
  { q: "Welche Zahlungsmethoden?", a: "Banküberweisung, Kreditkarte und TWINT." },
  { q: "Was bei fehlerhaftem Druck?", a: "Kostenloser Nachdruck — garantiert." },
];

const FAQ = () => (
  <section className="py-24 bg-[#111]">
    <div className="container mx-auto px-4">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 max-w-5xl mx-auto">
        <div className="md:col-span-4">
          <ScrollReveal>
            <p className="text-xs font-medium text-[#00cc66] uppercase tracking-widest mb-3">FAQ</p>
            <h2 className="text-3xl font-bold text-white tracking-tight">Häufige Fragen</h2>
          </ScrollReveal>
        </div>
        <div className="md:col-span-8">
          <ScrollReveal>
            <Accordion type="single" collapsible className="space-y-2">
              {faqItems.map((item, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="bg-[#0a0a0a] rounded-xl border border-white/8 px-5">
                  <AccordionTrigger className="font-semibold text-white hover:no-underline py-4 text-sm">{item.q}</AccordionTrigger>
                  <AccordionContent className="text-white/50 pb-4 text-sm leading-relaxed">{item.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </ScrollReveal>
        </div>
      </div>
    </div>
  </section>
);

const CTABanner = () => {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const scale = useTransform(scrollYProgress, [0, 0.5], [0.95, 1]);
  return (
    <section ref={ref} className="py-20 bg-[#0a0a0a]">
      <div className="container mx-auto px-4">
        <motion.div style={{ scale }}>
          <div className="bg-[#00cc66] rounded-2xl p-10 md:p-16 relative overflow-hidden">
            <div className="relative z-10 max-w-xl">
              <h2 className="text-3xl md:text-4xl font-extrabold text-black tracking-tight mb-4">
                Bereit für deinen ersten Druck?
              </h2>
              <p className="text-black/60 mb-8 leading-relaxed">
                Lade jetzt dein Modell hoch und erhalte sofort einen Preis.
              </p>
              <Button size="lg" asChild className="bg-black text-white hover:bg-black/80">
                <Link to="/kalkulator">Jetzt loslegen <ArrowRight className="w-4 h-4 ml-2" /></Link>
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

const WebsiteIndex = () => (
  <div>
    <Hero />
    <Marquee />
    <Stats />
    <HowItWorks />
    <MaterialsTeaser />
    <Testimonials />
    <FAQ />
    <CTABanner />
  </div>
);

export default WebsiteIndex;
