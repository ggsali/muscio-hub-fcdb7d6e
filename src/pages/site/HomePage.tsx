import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/site/ScrollReveal";
import { CountUp } from "@/components/site/CountUp";
import { Marquee } from "@/components/site/Marquee";
import {
  Upload, Settings, ShoppingCart, Package,
  Layers, ArrowRight, ArrowUpRight,
  Zap, Building2, CheckCircle,
} from "lucide-react";

import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { motion, AnimatePresence, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ReviewsSection } from "@/components/site/ReviewsSection";
import Seo from "@/components/site/Seo";
import { HeroImageMosaic } from "@/components/site/HeroImageMosaic";
import { isAcceptedModel, setPendingUploads } from "@/lib/pendingUpload";
import { toast } from "sonner";
import { company, fullAddress, localBusinessJsonLd, faqJsonLd } from "@/data/company";



/* ─── HERO BENTO ─── */
const HERO_STATS = [
  { value: 500, suffix: "+", label: "Teile gedruckt", icon: Layers, link: "/projekte" },
  { value: "AUCH B2B", label: "FÜR GESCHÄFTSKUNDEN", icon: Building2, link: "/leistungen" },
  { value: 99, suffix: "%", label: "Termingerecht", accent: true, icon: CheckCircle, link: "/ueber-uns" },
  { value: 48, suffix: "h", label: "Produktionszeit", icon: Zap, link: "/kalkulator-online" },
];

const HeroUploadButton = () => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [textIndex, setTextIndex] = useState(0);

  const buttonTexts = [
    { text: "STL hochladen", icon: ArrowRight },
    { text: "STEP hochladen", icon: ArrowRight },
    { text: "3MF hochladen", icon: ArrowRight },
    { text: "OBJ hochladen", icon: ArrowRight },
    { text: "Preis berechnen", icon: ArrowRight },
  ];

  useEffect(() => {
    const delay = textIndex === buttonTexts.length - 1 ? 4000 : 2500;
    const timeout = setTimeout(() => {
      setTextIndex((i) => (i + 1) % buttonTexts.length);
    }, delay);
    return () => clearTimeout(timeout);
  }, [textIndex]);

  const handleFiles = (files: File[]) => {
    const accepted = files.filter((f) => isAcceptedModel(f.name));
    if (accepted.length === 0) {
      toast.error("Bitte eine STL-, STEP-, 3MF- oder OBJ-Datei wählen.");
      return;
    }
    setPendingUploads(accepted);
    navigate("/kalkulator-online");
  };

  const current = buttonTexts[textIndex];
  const Icon = current.icon;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".stl,.step,.stp,.3mf,.obj,model/stl,model/x.stl-ascii,model/x.stl-binary,application/sla,application/vnd.ms-pki.stl,application/octet-stream,*/*"
        className="hidden"
        onChange={(e) => {
          handleFiles(Array.from(e.target.files || []));
          e.target.value = "";
        }}
      />
      <Button
        size="lg"
        className="rounded-xl min-h-[52px] px-8 text-base min-w-[210px]"
        onClick={() => inputRef.current?.click()}
      >
        <span className="relative flex items-center justify-center h-6 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.span
              key={current.text}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="flex items-center gap-1.5"
            >
              {current.text}
              <Icon className="w-4 h-4 shrink-0" />
            </motion.span>
          </AnimatePresence>
        </span>
      </Button>
    </>
  );
};

const HeroBento = () => (
  <section className="relative overflow-hidden pt-8 pb-6 md:pt-12">
    <div
      className="absolute inset-0 opacity-[0.03] pointer-events-none"
      style={{
        backgroundImage:
          "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
      }}
    />
    <div className="absolute top-0 right-0 w-[600px] h-[500px] bg-primary/[0.07] rounded-full blur-[120px] pointer-events-none" />

    <div className="container mx-auto px-4 relative z-10 flex flex-col gap-4 md:gap-6">
      {/* Reihe 1 — Hero-Text + Bild-Moodboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 items-stretch">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="lg:col-span-7 bg-card border border-border rounded-3xl p-6 md:p-12 shadow-[0_4px_20px_-4px_hsl(var(--foreground)/0.05)] relative overflow-hidden"
        >
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse mr-2" />
            Produktion in 48h versandbereit
          </span>

          <h1 className="font-heading text-[clamp(2rem,5vw,3.75rem)] font-bold leading-[1.1] tracking-tight text-foreground mb-5">
            3D-Druck aus der Schweiz.{" "}
            <span className="text-primary">Datei hochladen, Sofortpreis erhalten</span>, in 48h geliefert.
          </h1>

          <p className="text-base md:text-xl text-muted-foreground max-w-xl mb-8 leading-relaxed">
            Professioneller 3D-Druck für Prototypen, Ersatzteile und Kleinserien. Sofortpreis,
            schnelle Lieferung und Schweizer Präzision.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <HeroUploadButton />
            <Button size="lg" variant="outline" asChild className="rounded-xl min-h-[52px] px-8 text-base">
              <Link to="/materialien">Materialien entdecken</Link>
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.12 }}
          className="lg:col-span-5 flex items-center"
        >
          <div className="w-full md:pt-6">
            <HeroImageMosaic />
          </div>
        </motion.div>
      </div>

    </div>
  </section>
);

/* ─── STATS + TRUST (kompakt) ─── */
const StatsTrust = () => (
  <section className="py-10 md:py-14">
    <div className="container mx-auto px-4 flex flex-col gap-3 md:gap-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {HERO_STATS.map((s, i) => (
          <ScrollReveal key={s.label} delay={i * 0.06}>
            <Link
              to={s.link}
              className="block bg-card border border-border rounded-2xl p-5 md:p-6 h-full cursor-pointer no-underline transition-all hover:scale-[1.02] hover:shadow-[0_8px_24px_-4px_hsl(var(--foreground)/0.12)] group"
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3 transition-colors group-hover:bg-primary/20">
                <s.icon className="w-4.5 h-4.5 text-primary" strokeWidth={2.5} />
              </div>
              <div
                className={`text-2xl md:text-3xl font-heading font-bold mb-1 ${s.accent ? "text-primary" : "text-foreground"}`}
              >
                {typeof s.value === "string" ? (
                  s.value
                ) : (
                  <CountUp end={s.value} suffix={s.suffix} />
                )}
              </div>
              <div className="text-[11px] md:text-sm text-muted-foreground font-medium uppercase tracking-wider">
                {s.label}
              </div>
            </Link>
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

const StepNumber = ({ value, shouldReduceMotion }: { value: number; shouldReduceMotion: boolean }) => {
  if (shouldReduceMotion) return <span>{String(value).padStart(2, "0")}</span>;
  return (
    <CountUp end={value} duration={500} prefix="0" />
  );
};

const HowItWorks = () => {
  const shouldReduceMotion = useReducedMotion();
  const containerVariants = {
    hidden: { opacity: shouldReduceMotion ? 1 : 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.15,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: shouldReduceMotion ? 0 : 0.5, ease: "easeOut" as const },
    },
  };

  return (
    <section className="py-20 md:py-28 bg-foreground text-background overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">
          {/* Titel links */}
          <motion.div
            className="lg:col-span-3"
            initial={{ opacity: shouldReduceMotion ? 1 : 0, y: shouldReduceMotion ? 0 : 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.6 }}
          >
            <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">Prozess</p>
            <h2 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-tight">
              Vom Modell zum Bauteil.
            </h2>
            <p className="text-background/70 mt-4 text-base">In vier Schritten.</p>
          </motion.div>

          {/* Schritte rechts */}
          <div className="lg:col-span-9">
            <motion.div
              className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-4"
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
            >
              {/* Verbindungslinie */}
              <motion.div
                className="absolute top-[4.5rem] left-0 right-0 h-px bg-primary origin-left hidden lg:block"
                initial={{ scaleX: shouldReduceMotion ? 1 : 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.6, delay: 0.4, ease: "easeInOut" }}
              />

              {steps.map((step, i) => (
                <motion.div
                  key={step.title}
                  variants={itemVariants}
                  whileHover={shouldReduceMotion ? undefined : { scale: 1.03 }}
                  className="relative z-10 group"
                >
                  <div className="bg-background/5 border border-background/10 rounded-2xl p-6 h-full backdrop-blur-sm transition-colors duration-300 group-hover:bg-background/10 group-hover:border-primary/40">
                    <div className="text-6xl font-heading font-bold text-primary/80 mb-4 tabular-nums leading-none">
                      <StepNumber value={i + 1} shouldReduceMotion={!!shouldReduceMotion} />
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-background/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors duration-300">
                      <motion.div
                        className="text-background"
                        whileHover={shouldReduceMotion ? undefined : { rotate: 5 }}
                        transition={{ duration: 0.2 }}
                      >
                        <step.icon className="w-5 h-5" strokeWidth={2} />
                      </motion.div>
                    </div>
                    <h3 className="font-heading text-lg font-bold text-background mb-2">{step.title}</h3>
                    <p className="text-background/70 text-sm leading-relaxed">{step.desc}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
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

/* ─── FAQ ─── */
const faqs = [
  { q: "Was kostet ein 3D-Druck?", a: "Der Preis ergibt sich aus Material, Druckzeit und Nachbearbeitung. Im Online-Kalkulator sehen Sie den Preis sofort und transparent aufgeschlüsselt — ab CHF 0.055/g Material. Ab 5 Stück gibt es 10 %, ab 10 Stück 15 % Mengenrabatt." },
  { q: "Wie lange dauert die Lieferung?", a: "Standard 48 Stunden Produktionszeit ab Auftragsbestätigung, danach Versand mit Post oder DHL innerhalb der Schweiz (1–2 Tage). Express ist auf Anfrage möglich, Abholung in Eschlikon TG jederzeit." },
  { q: "Welche Dateiformate werden unterstützt?", a: "STL, STEP/STP, 3MF und OBJ bis 500 MB. Der Kalkulator berechnet Volumen und Gewicht automatisch aus Ihrer Datei — ohne manuelle Eingabe." },
  { q: "Welche Materialien stehen zur Auswahl?", a: "FDM: PLA, PETG, ABS, ASA, TPU und Nylon in über 12 Farben. SLA: Resin für höchste Detailtreue. Unsicher? Wir beraten Sie kostenlos zur Materialwahl." },
  { q: "Welche Toleranzen und Genauigkeit erreichen Sie?", a: "FDM typisch ±0.1 bis ±0.2 mm bei Schichthöhen von 0.1–0.3 mm. SLA/Resin erreicht Auflösungen bis 0.025 mm für filigrane Bauteile." },
  { q: "Eignet sich der Service für industrielle Anwendungen?", a: "Ja. Wir fertigen Funktionsteile, Betriebsmittel, Vorrichtungen und Ersatzteile für KMU, Startups und Industriekunden — auch als Kleinserie mit reproduzierbaren Parametern." },
  { q: "Wie erfolgt der Versand?", a: "Versand als Paket mit Schweizer Post oder DHL, ab CHF 65 Bestellwert kostenlos. Kein Zoll, keine Wartezeit aus dem Ausland. Abholung vor Ort ist ebenfalls möglich." },
  { q: "Wie stellen Sie die Qualität sicher?", a: "Jedes Teil wird vor dem Versand visuell und dimensionell geprüft. Fehldrucke gehen nicht raus — bei Abweichungen drucken wir kostenlos nach." },
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
        <Button size="lg" variant="default" asChild className="rounded-full shadow-[0_0_30px_hsl(156_100%_40%/0.4)]">
          <Link to="/kalkulator-online">Jetzt starten <ArrowRight className="w-4 h-4 ml-1.5" /></Link>
        </Button>
      </div>
    </div>
  </section>
);

/* ─── ENTITY / KURZANTWORT ─── */
const EntityAnswer = () => (
  <section className="py-16">
    <div className="container mx-auto px-4 max-w-4xl">
      <ScrollReveal>
        <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
          <h2 className="font-heading text-xl md:text-2xl font-bold mb-3">Was ist 3DMuscio?</h2>
          <p className="text-muted-foreground leading-relaxed">{company.shortDescription}</p>
          <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-3 mt-6 text-sm">
            {[
              ["Standort", fullAddress],
              ["Verfahren", company.processes.join(", ")],
              ["Materialien", company.materials.join(", ")],
              ["Dateiformate", company.fileFormats.join(", ")],
              ["Produktionszeit", company.productionTime],
              ["Mindestmenge", company.minOrder],
            ].map(([k, v]) => (
              <div key={k} className="flex flex-col border-t border-border pt-3">
                <dt className="text-xs uppercase tracking-widest text-primary font-semibold">{k}</dt>
                <dd className="text-muted-foreground mt-1">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap gap-2 mt-6">
            {[
              { label: "Leistungen", to: "/leistungen" },
              { label: "Materialien", to: "/materialien" },
              { label: "Preise & Kosten", to: "/wissen/3d-druck-kosten-schweiz" },
              { label: "3D-Druck Thurgau", to: "/standorte/thurgau" },
            ].map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:border-primary/40 transition-colors"
              >
                {l.label}
                <ArrowRight className="w-3.5 h-3.5 text-primary" />
              </Link>
            ))}
          </div>
        </div>
      </ScrollReveal>
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
                3DMuscio ist spezialisiert auf Geschäftskunden. Wir unterstützen KMUs, Startups und Industrieunternehmen in der ganzen Schweiz mit zuverlässigen 3D-Druckdienstleistungen. Von der Einzelbestellung bis zur Serienfertigung, wir finden die optimale Lösung für Ihr Projekt.
              </p>
            </div>
            <div>
              <h3 className="font-heading text-lg font-bold text-foreground mb-2">Dateiformate und Upload</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Laden Sie Ihre 3D-Modelle einfach online hoch. Wir akzeptieren STL, OBJ und STEP Dateien bis 500MB. Unser Sofort-Kalkulator berechnet automatisch Volumen und Preis aus Ihrer STL-Datei, ohne manuelle Eingabe.
              </p>
            </div>
          </div>
        </ScrollReveal>
      </div>

      <ScrollReveal>
        <div className="mt-10 pt-6 border-t border-border">
          <h3 className="font-heading text-lg font-bold text-foreground mb-2">Warum 3DMuscio?</h3>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Als junges Schweizer Unternehmen legen wir grossen Wert auf Qualität, Zuverlässigkeit und persönlichen Service. Jeder Auftrag wird sorgfältig geprüft und mit modernster Technologie umgesetzt. Unser Ziel ist es, Ihnen den besten 3D-Druck Service in der Schweiz zu bieten, schnell, günstig und zuverlässig.
          </p>
        </div>
      </ScrollReveal>

      <ScrollReveal>
        <p className="mt-10 text-xs text-muted-foreground/80 leading-relaxed">
          3DMuscio fertigt 3D-gedruckte Kunststoffteile für Unternehmen und Privatpersonen in der
          ganzen Schweiz, vom einfachen Ersatzteil über individuelle Gehäuse und Halterungen bis hin
          zu Prototypen und Kleinserien. Unser Service in Eschlikon, Thurgau, ist spezialisiert auf
          schnelle, unkomplizierte Herstellung ohne Mindestbestellmenge. Ob FDM- oder SLA-Druck, ob
          PLA, PETG, ABS oder Resin, wir finden die passende Lösung für Ihr Projekt.
        </p>
      </ScrollReveal>
    </div>
  </section>
);

const Index = () => (
  <div>
    <Seo
      title="3D Druck Schweiz – Sofortpreis & 48h Lieferung | 3DMuscio"
      description="Datei hochladen, Sofortpreis erhalten, in 48h geliefert. Professioneller 3D-Druck aus der Schweiz für Prototypen, Ersatzteile und Kleinserien. FDM & SLA, 0.1 mm Präzision."
      path="/"
      jsonLd={[
        localBusinessJsonLd,
        {
          "@context": "https://schema.org",
          "@type": "WebSite",
          "@id": "https://3dmuscio.com/#website",
          url: "https://3dmuscio.com",
          name: company.name,
          inLanguage: "de-CH",
          publisher: { "@id": "https://3dmuscio.com/#organization" },
        },
        faqJsonLd(faqs),
      ]}
    />
    <HeroBento />
    <Marquee />
    <StatsTrust />
    <HowItWorks />
    <EntityAnswer />
    <MaterialsTeaser />
    <ReviewsSection />
    <FAQ />
    <CTA />
    <SEOContent />
  </div>
);

export default Index;
