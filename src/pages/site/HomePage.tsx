import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/site/ScrollReveal";
import { CountUp } from "@/components/site/CountUp";
import { Marquee } from "@/components/site/Marquee";
import {
  Upload, Settings, ShoppingCart, Package,
  Clock, Target, Layers, Users, ArrowRight, ArrowUpRight, Percent,
} from "lucide-react";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HeroProjectsCarousel } from "@/components/site/HeroProjectsCarousel";
import { ReviewsSection } from "@/components/site/ReviewsSection";
import { ProjectsGrid } from "@/components/site/ProjectsGrid";

/* ─── HERO ─── */
const Hero = () => {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const rightY = useTransform(scrollYProgress, [0, 1], [0, -60]);

  return (
    <section ref={ref} className="relative min-h-[calc(100vh-7rem)] flex items-center overflow-hidden py-12 lg:py-16">
      <div className="absolute inset-0 bg-background" />
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      <div className="absolute top-0 right-0 w-[600px] h-[500px] bg-primary/[0.06] rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-0 right-[25%] w-px h-full bg-gradient-to-b from-transparent via-primary/20 to-transparent hidden lg:block" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-12 items-center min-h-[80vh]">
          <motion.div style={{ y, opacity }}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-xs font-medium text-primary mb-8 tracking-wide uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                3D-Druck aus der Schweiz
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="font-heading text-[clamp(2.8rem,6vw,5.5rem)] font-extrabold leading-[1.0] mb-6 text-foreground tracking-tight"
            >
              Schicht für<br />
              <span className="relative inline-block">
                Schicht
                <motion.span
                  className="absolute -bottom-1 left-0 h-[3px] bg-primary rounded-full"
                  initial={{ width: 0 }} animate={{ width: "100%" }}
                  transition={{ delay: 0.8, duration: 0.6 }}
                />
              </span><br />
              <span className="text-primary">perfekt.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="text-base text-muted-foreground mb-10 leading-relaxed max-w-sm"
            >
              Präzisionsdruck Layer für Layer. Von der Idee zum fertigen Teil in 48h — zuverlässig, bezahlbar, aus der Schweiz.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.35 }}
              className="flex flex-col sm:flex-row gap-3"
            >
              <Button variant="default" size="lg" asChild
                className="rounded-full shadow-[0_0_30px_hsl(153_100%_40%/0.3)] hover:shadow-[0_0_40px_hsl(153_100%_40%/0.5)] transition-shadow">
                <Link to="/kalkulator-online">Preis berechnen <ArrowRight className="w-4 h-4 ml-1.5" /></Link>
              </Button>
              <Button variant="outline" size="lg" asChild className="rounded-full">
                <Link to="/materialien">Materialien entdecken</Link>
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
              className="flex items-center gap-6 mt-12"
            >
              {[
                { val: "48h", label: "Lieferzeit" },
                { val: "0.1mm", label: "Präzision" },
                { val: "12+", label: "Materialien" },
              ].map((s, i) => (
                <div key={i} className="flex flex-col">
                  <span className="font-heading font-extrabold text-lg text-foreground leading-none">{s.val}</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">{s.label}</span>
                </div>
              ))}
            </motion.div>
          </motion.div>

          <motion.div
            className="flex items-center justify-center mt-8 lg:mt-0"
            style={{ y: rightY }}
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.4 }}
          >
            <HeroProjectsCarousel />
          </motion.div>
        </div>
      </div>
    </section>
  );
};

/* ─── STATS ─── */
const STATS = [
  { icon: Clock, value: 48, suffix: "h", label: "Lieferzeit" },
  { icon: Target, value: 0.1, suffix: "mm", label: "Präzision", decimals: 1 },
  { icon: Layers, value: 12, suffix: "+", label: "Materialien" },
  { icon: Users, value: 100, suffix: "%", label: "Schweizer Qualität" },
];

const Stats = () => (
  <section className="py-20 overflow-hidden">
    <div className="container mx-auto px-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-12">
        {STATS.map((s, i) => (
          <ScrollReveal key={i} delay={i * 0.08}>
            <div className="relative">
              <span className="text-[3rem] font-heading font-black text-foreground/[0.03] absolute -top-4 -left-2 leading-none select-none">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="relative">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                  <s.icon className="w-4 h-4 text-primary" />
                </div>
                <div className="text-3xl md:text-4xl font-heading font-extrabold text-foreground tracking-tight">
                  <CountUp end={s.value} suffix={s.suffix} decimals={s.decimals || 0} />
                </div>
                <p className="text-muted-foreground mt-1 text-xs uppercase tracking-widest">{s.label}</p>
              </div>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </div>
  </section>
);

/* ─── HOW IT WORKS ─── */
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
    <section ref={ref} className="py-28 relative">
      <div className="container mx-auto px-4">
        <ScrollReveal>
          <div className="mb-16 max-w-md">
            <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">Prozess</p>
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground tracking-tight">
              Vier Schritte.<br />Ein Ergebnis.
            </h2>
          </div>
        </ScrollReveal>

        <div className="relative max-w-3xl">
          <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border hidden md:block">
            <motion.div className="w-full bg-primary origin-top" style={{ height: lineHeight }} />
          </div>

          <div className="space-y-8 md:space-y-12">
            {steps.map((step, i) => (
              <ScrollReveal key={i} delay={i * 0.08}>
                <motion.div className="flex gap-6 md:gap-8 items-start group" whileHover={{ x: 4 }}>
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg border border-border bg-card flex items-center justify-center relative z-10 group-hover:border-primary group-hover:bg-primary/5 transition-all duration-200">
                    <step.icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-baseline gap-3 mb-1">
                      <span className="text-[10px] font-bold text-muted-foreground tracking-widest">{String(i + 1).padStart(2, "0")}</span>
                      <h3 className="font-heading text-lg font-bold text-foreground">{step.title}</h3>
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed">{step.desc}</p>
                  </div>
                </motion.div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

/* ─── MATERIALS TEASER ─── */
interface MaterialTeaser { name: string; price: string; tag: string; desc: string; }

const MaterialsTeaser = () => {
  const [materialTeaser, setMaterialTeaser] = useState<MaterialTeaser[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("materials")
        .select("name, price_per_gram, tag, description")
        .eq("aktiv", true)
        .order("sort_order")
        .limit(4);
      if (data) {
        setMaterialTeaser(
          data.map((m: any) => ({
            name: m.name,
            price: Number(m.price_per_gram).toFixed(3).replace(/0+$/, "").replace(/\.$/, ""),
            tag: m.tag,
            desc: m.description || "",
          })),
        );
      }
    })();
  }, []);
  return (
  <section className="py-24 bg-foreground text-background overflow-hidden">
    <div className="container mx-auto px-4">
      <div className="flex items-end justify-between mb-10">
        <div>
          <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">Materialien</p>
          <h2 className="font-heading text-3xl md:text-4xl font-bold tracking-tight">
            Für jeden Einsatz das<br className="hidden md:block" /> richtige Material.
          </h2>
        </div>
        <Link to="/materialien" className="hidden md:flex items-center gap-1 text-sm font-medium text-primary hover:underline underline-offset-4">
          Alle ansehen <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {materialTeaser.map((m, i) => (
          <motion.div
            key={i}
            className="rounded-xl p-5 border border-background/10 hover:border-primary/40 bg-background/5 backdrop-blur-sm transition-colors group cursor-pointer"
            whileHover={{ y: -4, scale: 1.02 }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-heading text-base font-bold">{m.name}</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-background/10 tracking-wider">{m.tag}</span>
            </div>
            <p className="text-background/60 text-sm mb-4">{m.desc}</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-background/50">ab</span>
              <span className="font-heading font-extrabold text-primary">CHF {m.price}/g</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
  );
};

/* ─── VOLUME DISCOUNTS ─── */
const discounts = [
  { qty: "Ab 5 Stück", value: "10%", desc: "Rabatt auf den Gesamtpreis" },
  { qty: "Ab 10 Stück", value: "15%", desc: "Rabatt auf den Gesamtpreis" },
  { qty: "Auf Anfrage", value: "★", desc: "Individuelle Konditionen für grössere Mengen" },
];

const VolumeDiscounts = () => (
  <section className="py-24 bg-foreground text-background overflow-hidden">
    <div className="container mx-auto px-4">
      <ScrollReveal>
        <div className="mb-10 max-w-2xl">
          <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">Mengenrabatte</p>
          <h2 className="font-heading text-3xl md:text-4xl font-bold tracking-tight">
            Mehr drucken,<br className="hidden md:block" /> weniger zahlen.
          </h2>
        </div>
      </ScrollReveal>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {discounts.map((d, i) => (
          <ScrollReveal key={i} delay={i * 0.08}>
            <motion.div
              className="rounded-xl p-6 border border-background/10 hover:border-primary/40 bg-background/5 backdrop-blur-sm transition-colors h-full"
              whileHover={{ y: -4, scale: 1.02 }}
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Percent className="w-4 h-4 text-primary" />
              </div>
              <p className="text-xs text-background/60 uppercase tracking-widest mb-2">{d.qty}</p>
              <div className="font-heading text-4xl font-extrabold text-primary mb-2">{d.value}</div>
              <p className="text-sm text-background/70">{d.desc}</p>
            </motion.div>
          </ScrollReveal>
        ))}
      </div>
    </div>
  </section>
);

/* ─── FAQ ─── */
const faqs = [
  { q: "Wie lange dauert die Lieferung?", a: "Standard 48 Stunden ab Auftragsbestätigung. Express auf Anfrage möglich." },
  { q: "Welche Dateiformate akzeptiert ihr?", a: "STL, OBJ, STEP und 3MF. Bei Fragen helfen wir gerne weiter." },
  { q: "Wie genau sind die Drucke?", a: "Toleranzen typisch ±0.1 mm bei FDM, noch feiner bei Resin/SLA." },
  { q: "Was kostet ein Druck?", a: "Online im Preisrechner direkt kalkulieren — Material, Zeit und Nachbearbeitung sind transparent ausgewiesen." },
];

const FAQ = () => (
  <section className="py-28 relative">
    <div className="container mx-auto px-4 max-w-3xl">
      <ScrollReveal>
        <div className="mb-12 text-center">
          <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">FAQ</p>
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground tracking-tight">
            Häufige Fragen.
          </h2>
        </div>
      </ScrollReveal>
      <ScrollReveal>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`f-${i}`} className="border-border">
              <AccordionTrigger className="text-left font-heading font-semibold hover:no-underline">{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-sm leading-relaxed">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </ScrollReveal>
    </div>
  </section>
);

/* ─── CTA ─── */
const CTA = () => (
  <section className="py-24">
    <div className="container mx-auto px-4">
      <div className="relative overflow-hidden rounded-3xl bg-foreground text-background p-10 md:p-16 text-center">
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
        <h2 className="font-heading text-3xl md:text-5xl font-extrabold mb-4 relative">Bereit, dein Teil zu drucken?</h2>
        <p className="text-background/70 mb-8 relative">Sofort Preis berechnen und in 48h dein Bauteil erhalten.</p>
        <Button size="lg" variant="default" asChild className="rounded-full shadow-[0_0_30px_hsl(153_100%_40%/0.4)]">
          <Link to="/kalkulator-online">Jetzt starten <ArrowRight className="w-4 h-4 ml-1.5" /></Link>
        </Button>
      </div>
    </div>
  </section>
);

/* ─── SEO CONTENT ─── */
const SEOContent = () => (
  <section className="py-20 bg-muted/30">
    <div className="container mx-auto px-4 max-w-4xl">
      <ScrollReveal>
        <div className="mb-10">
          <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">Leistungen</p>
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground tracking-tight">
            Ihr professioneller 3D-Druck Partner in der Schweiz
          </h2>
        </div>
      </ScrollReveal>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <ScrollReveal>
          <div className="space-y-6">
            <div>
              <h3 className="font-heading text-lg font-bold text-foreground mb-2">FDM 3D-Druck</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Unser FDM-Druckservice bietet hochwertige Bauteile aus PLA, PETG, ABS, ASA, TPU und Nylon. Ideal für Prototypen, Funktionsteile, Gehäuse und individuelle Bauteile. Dank modernster Bambu Lab Drucker erreichen wir Präzision bis 0.1mm und Druckgeschwindigkeiten von bis zu 600mm/s.
              </p>
            </div>
            <div>
              <h3 className="font-heading text-lg font-bold text-foreground mb-2">SLA Resin-Druck</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Für höchste Detailgenauigkeit bieten wir SLA Resin-Druck an. Perfekt für Schmuck, Miniaturen, Zahntechnik und filigrane Bauteile mit glatten Oberflächen. Auflösung bis zu 0.025mm für perfekte Ergebnisse bei anspruchsvollsten Projekten.
              </p>
            </div>
            <div>
              <h3 className="font-heading text-lg font-bold text-foreground mb-2">Schnelle Lieferung in der Schweiz</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Als Schweizer Unternehmen aus Eschlikon TG liefern wir Ihre Drucke innerhalb von 48 Stunden. Kein Zoll, keine langen Wartezeiten aus dem Ausland. Versand mit Post oder DHL, kostenlos ab CHF 65 Bestellwert.
              </p>
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <div className="space-y-6">
            <div>
              <h3 className="font-heading text-lg font-bold text-foreground mb-2">Faire Preise und Mengenrabatte</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Transparente Preise ab CHF 0.055/g für PLA-Druck. Mengenrabatte ab 5 Stück (10%) und ab 10 Stück (15%). Online-Kalkulator für sofortige Preisberechnung. Keine versteckten Kosten, verbindliches Angebot innerhalb 24 Stunden.
              </p>
            </div>
            <div>
              <h3 className="font-heading text-lg font-bold text-foreground mb-2">B2B Fokus</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                3DMuscio ist spezialisiert auf Geschäftskunden. Wir unterstützen KMUs, Startups und Industrieunternehmen in der ganzen Schweiz mit zuverlässigen 3D-Druckdienstleistungen. Von der Einzelbestellung bis zur Serienfertigung — wir finden die optimale Lösung für Ihr Projekt.
              </p>
            </div>
            <div>
              <h3 className="font-heading text-lg font-bold text-foreground mb-2">Dateiformate und Upload</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Laden Sie Ihre 3D-Modelle einfach online hoch. Wir akzeptieren STL, OBJ und STEP Dateien bis 500MB. Unser Sofort-Kalkulator berechnet automatisch Volumen und Preis aus Ihrer STL-Datei — ohne manuelle Eingabe.
              </p>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </div>
  </section>
);

const Index = () => (
  <div>
    <Hero />
    <Marquee />
    <Stats />
    <HowItWorks />
    <ProjectsGrid />
    <MaterialsTeaser />
    <VolumeDiscounts />
    <ReviewsSection />
    <FAQ />
    <CTA />
    <SEOContent />
  </div>
);

export default Index;
