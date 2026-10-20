import { Link, useNavigate } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/site/ScrollReveal";
import { CountUp } from "@/components/site/CountUp";
import { Marquee } from "@/components/site/Marquee";
import {
  Upload, Settings, ShoppingCart, Package,
  Layers, ArrowRight, ArrowUpRight,
  Zap, Building2, CheckCircle,
} from "lucide-react";

import { motion, AnimatePresence, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import { useResinEnabled, isResinText, stripResin } from "@/hooks/useResinEnabled";
import { supabase } from "@/integrations/supabase/client";
import { ReviewsSection } from "@/components/site/ReviewsSection";
import { useReviewData } from "@/hooks/useReviewData";
import Seo from "@/components/site/Seo";
import { HeroImageMosaic } from "@/components/site/HeroImageMosaic";
import { PrintVisual, usePinnedProgress, StatementReveal, ServicesHorizontal, ProcessSticky, ScrollBar, Rise } from "@/components/site/HomeMotion";
import { isAcceptedModel, setPendingUploads } from "@/lib/pendingUpload";
import { toast } from "sonner";
import { company, fullAddress, faqJsonLd } from "@/data/company";



/* ─── HERO BENTO ─── */
const HERO_STATS = [
  { value: 500, suffix: "+", label: "Teile gedruckt", icon: Layers, link: "/projekte" },
  { value: "AUCH B2B", label: "FÜR GESCHÄFTSKUNDEN", icon: Building2, link: "/leistungen" },
  { value: 99, suffix: "%", label: "Termingerecht", accent: true, icon: CheckCircle, link: "/ueber-uns" },
  { value: 48, suffix: "h", label: "Schnellfertigung möglich", icon: Zap, link: "/kalkulator-online" },
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

const HeroBento = () => {
  const resin = useResinEnabled();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [drag, setDrag] = useState(false);
  const { progress, live } = usePinnedProgress(sectionRef);

  const handleFiles = (files: File[]) => {
    const accepted = files.filter((f) => isAcceptedModel(f.name));
    if (accepted.length === 0) {
      toast.error("Bitte eine STL-, STEP-, 3MF- oder OBJ-Datei wählen.");
      return;
    }
    setPendingUploads(accepted);
    navigate("/kalkulator-online");
  };

  const word = (i: number) => ({
    initial: { opacity: 0, y: 28 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay: 0.1 + i * 0.09, ease: [0.22, 1, 0.36, 1] as const },
  });
  const G = "text-[hsl(156_100%_46%)]";
  const lnk = "text-background underline underline-offset-4 decoration-background/30 hover:decoration-[hsl(156_100%_46%)]";

  return (
  <section ref={sectionRef} className="relative bg-foreground text-background" style={live ? { height: "270vh" } : undefined}>
    <div className={live ? "sticky top-0 h-screen overflow-hidden" : "overflow-hidden"}>
      <motion.div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(0 0% 100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          backgroundPositionY: useTransform(progress, [0, 1], ["0px", "-280px"]),
        }}
      />
      <div className={`container mx-auto px-4 relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center ${live ? "h-full pt-[150px] pb-8" : "pt-14 pb-16 md:pt-20"}`}>
        <div className="lg:col-span-6">
          <motion.p {...word(0)} className={`mb-5 flex items-center gap-3 text-[13px] font-semibold uppercase tracking-[0.14em] ${G}`}>
            <span className="h-px w-8 bg-[hsl(156_100%_46%)]" />
            Eschlikon TG · 3D-Druck in nur 48 Stunden*
          </motion.p>

          <h1 className="font-heading text-[clamp(2.2rem,4.7vw,4.3rem)] font-bold leading-[1.03] tracking-[-0.03em] text-background mb-5">
            {["3D-Druckservice", "Schweiz", "–"].map((w, i) => (
              <motion.span key={w + i} {...word(i + 1)} className="mr-[0.25em] inline-block">{w}</motion.span>
            ))}
            <motion.span {...word(4)} className={`mr-[0.25em] inline-block ${G}`}>{resin ? "FDM & SLA" : "FDM"}</motion.span>
            <motion.span {...word(5)} className="inline-block">ab&nbsp;1&nbsp;Stück.</motion.span>
          </h1>

          <motion.p {...word(6)} className="text-base md:text-[17px] text-background/75 max-w-xl mb-3 leading-relaxed">
            3DMuscio fertigt in Eschlikon TG Prototypen, Funktionsteile, Ersatzteile und Kleinserien
            für Privatkunden, Entwickler, Startups und Unternehmen. Datei hochladen, Sofortpreis
            sehen – schnelle Fertigung, hohe Qualität und zuverlässiger Versand in der ganzen Schweiz.
          </motion.p>
          <p className="text-xs text-background/50 mb-4 max-w-xl">
            *Bei geeigneten Aufträgen ist eine Fertigung innerhalb von 48 Stunden möglich. Die tatsächliche Produktions- und Lieferzeit hängt von Material, Auftragsumfang und Auslastung ab.
          </p>
          <p className="text-sm text-background/60 mb-6">
            Verfahren: <Link to="/leistungen/fdm-3d-druck" className={lnk}>FDM 3D-Druck</Link> für belastbare Teile ·{" "}
            {resin && (<><Link to="/leistungen/sla-3d-druck" className={lnk}>SLA / Resin 3D-Druck</Link> für feine Details ·{" "}</>)}
            <Link to="/3d-druck-schweiz" className={lnk}>Überblick 3D-Druck Schweiz</Link>
          </p>

          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".stl,.step,.stp,.3mf,.obj,model/stl,model/x.stl-ascii,model/x.stl-binary,application/sla,application/vnd.ms-pki.stl,application/octet-stream,*/*"
            className="hidden"
            onChange={(e) => { handleFiles(Array.from(e.target.files || [])); e.target.value = ""; }}
          />
          <motion.button
            {...word(7)}
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(Array.from(e.dataTransfer.files || [])); }}
            whileHover={{ scale: 1.012 }}
            whileTap={{ scale: 0.99 }}
            className={`group w-full max-w-xl flex items-center gap-5 rounded-lg border-2 border-dashed px-5 py-4 text-left transition-colors ${drag ? "border-[hsl(156_100%_46%)] bg-[hsl(156_100%_46%)]/10" : "border-background/35 hover:border-[hsl(156_100%_46%)] hover:bg-background/5"}`}
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-[hsl(156_100%_46%)] text-foreground">
              <Upload className="h-5 w-5" strokeWidth={2.25} />
            </span>
            <span className="min-w-0">
              <span className="block font-heading text-base md:text-lg font-semibold text-background">3D-Datei hier ablegen oder auswählen</span>
              <span className="block text-sm text-background/60">STL · STEP · 3MF · OBJ – Preis in Sekunden, echt berechnet</span>
            </span>
            <ArrowRight className="ml-auto hidden h-5 w-5 shrink-0 text-background/50 transition-transform group-hover:translate-x-1 sm:block" />
          </motion.button>
        </div>

        <div className="lg:col-span-6">
          <PrintVisual progress={progress} />
          <p className="mt-3 text-center text-xs text-background/45">
            {live ? "Scrollen: das Teil wird Schicht für Schicht gedruckt und berechnet – Beispielwerte" : "So rechnet unser Kalkulator – Beispielwerte"}
          </p>
        </div>
      </div>
    </div>
  </section>
  );
};

/* ─── STATS + TRUST (kompakt) ─── */
const StatsTrust = () => (
  <section className="border-b border-border">
    <div className="container mx-auto px-4">
      <div className="grid grid-cols-2 md:grid-cols-4 md:divide-x divide-border">
        {HERO_STATS.map((s, i) => (
          <Link
            key={s.label}
            to={s.link}
            className="group block py-8 md:py-10 md:px-8 first:md:pl-0 no-underline border-b md:border-b-0 border-border odd:border-r md:odd:border-r-0"
          >
            <div className="font-heading text-3xl md:text-5xl font-bold tracking-tight text-foreground mb-2 tabular-nums">
              {typeof s.value === "string" ? s.value : <CountUp end={s.value} suffix={s.suffix} />}
            </div>
            <div className="text-xs md:text-sm text-muted-foreground font-medium uppercase tracking-wider group-hover:text-primary transition-colors">
              {s.label}
            </div>
          </Link>
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
  { icon: Package, title: "Erhalten", desc: "Wir drucken und prüfen dein Teil und versenden es mit Post oder DHL." },
];

const StepNumber = ({ value, shouldReduceMotion }: { value: number; shouldReduceMotion: boolean }) => {
  if (shouldReduceMotion) return <span>{String(value).padStart(2, "0")}</span>;
  return (
    <CountUp end={value} duration={500} prefix="0" />
  );
};

const HowItWorks = () => <ProcessSticky steps={steps} />;

/* ─── LEISTUNGEN ─── */
const Services = () => {
  const resin = useResinEnabled();
  const items = [
    { t: "FDM 3D-Druck", d: "Belastbare Funktionsteile, Gehäuse und Halterungen in PLA, PETG, ABS, ASA, TPU und Nylon.", to: "/leistungen/fdm-3d-druck" },
    ...(resin ? [{ t: "SLA Resin Druck", d: "Feine Details und glatte Oberflächen bis 0.025 mm.", to: "/leistungen/sla-3d-druck" }] : []),
    { t: "Prototypen", d: "Vom ersten Entwurf zum greifbaren Muster – schnell iterieren.", to: "/leistungen/3d-druck-prototypen" },
    { t: "Ersatzteile", d: "Nicht mehr lieferbar? Wir drucken es nach, passgenau.", to: "/leistungen/3d-druck-ersatzteile" },
    { t: "Kleinserien", d: "Reproduzierbare Parameter, ab 5 Stück mit Mengenrabatt.", to: "/leistungen/3d-druck-kleinserien" },
  ];
  return <ServicesHorizontal items={items} />;
};

/* ─── WERKSTATT / PROJEKTE ─── */
const Werkstatt = () => (
  <section className="py-20 md:py-28 bg-muted">
    <div className="container mx-auto px-4 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
      <Rise className="lg:col-span-5">
        <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-primary">Projekte</p>
        <h2 className="font-heading text-3xl md:text-5xl font-bold tracking-tight mb-5">Echte Teile aus Eschlikon.</h2>
        <p className="text-muted-foreground leading-relaxed mb-8 max-w-md">
          Jedes Teil wird bei uns gedruckt, geprüft und von Hand verpackt. Ein Einblick in aktuelle Aufträge aus Prototypenbau, Ersatzteilen und Kleinserien.
        </p>
        <Button asChild size="lg" className="rounded-md">
          <Link to="/projekte">Alle Projekte ansehen <ArrowRight className="ml-2 h-4 w-4" /></Link>
        </Button>
      </Rise>
      <Rise className="lg:col-span-7" delay={0.15}><HeroImageMosaic /></Rise>
    </div>
  </section>
);

/* ─── MATERIALS TEASER ─── */
interface MaterialTeaser { name: string; price: string; tag: string; desc: string; }

const MaterialsTeaser = () => {
  const [materialTeaser, setMaterialTeaser] = useState<MaterialTeaser[]>([]);
  const resin = useResinEnabled();
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("materials")
        .select("name, price_per_gram, tag, description")
        .eq("aktiv", true)
        .order("sort_order")
        .limit(6);
      if (data) {
        setMaterialTeaser(
          data.filter((m: any) => resin || (!isResinText(m.name) && !isResinText(m.tag))).slice(0, 4).map((m: any) => ({
            name: m.name,
            price: Number(m.price_per_gram).toFixed(3).replace(/0+$/, "").replace(/\.$/, ""),
            tag: m.tag,
            desc: m.description || "",
          })),
        );
      }
    })();
  }, [resin]);
  return (
  <section className="py-20 md:py-28 bg-foreground text-background overflow-hidden">
    <div className="container mx-auto px-4">
      <div className="flex items-end justify-between gap-4 mb-10">
        <div>
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-[hsl(156_100%_46%)]">Materialien</p>
          <h2 className="font-heading text-3xl md:text-5xl font-bold tracking-tight">
            Für jeden Einsatz das<br className="hidden md:block" /> richtige Material.
          </h2>
        </div>
        <Link to="/materialien" className="hidden md:flex items-center gap-1 text-sm font-semibold text-[hsl(156_100%_46%)] hover:underline underline-offset-4">
          Alle ansehen <ArrowUpRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="divide-y divide-background/15 border-y border-background/15">
        {materialTeaser.map((m, i) => (
          <Rise key={i} delay={i * 0.07}><Link to="/materialien" className="group grid grid-cols-[1fr_auto] md:grid-cols-[14rem_1fr_auto] items-center gap-x-8 gap-y-1 py-5 no-underline text-background transition-colors hover:bg-background/5 md:px-3 -mx-0">
            <div className="flex items-center gap-3">
              <h3 className="font-heading text-xl font-semibold">{m.name}</h3>
              {m.tag && <span className="text-[10px] font-semibold px-2 py-0.5 rounded border border-background/30 tracking-wider uppercase">{m.tag}</span>}
            </div>
            <p className="hidden md:block text-sm text-background/60">{m.desc}</p>
            <span className="font-heading font-semibold text-[hsl(156_100%_46%)] tabular-nums whitespace-nowrap">ab CHF {m.price}/g</span>
          </Link></Rise>
        ))}
      </div>
    </div>
  </section>
  );
};

/* ─── VOLUME DISCOUNTS ─── */

/* ─── FAQ ─── */
const FAQS_ALL = [
  { q: "Was kostet ein 3D-Druck in der Schweiz?", a: "Der Preis ergibt sich aus Material, Druckzeit und Nachbearbeitung — Kleinteile gibt es bereits ab CHF 5.–. Im Online-Kalkulator sehen Sie den Preis sofort und transparent aufgeschlüsselt, ab CHF 0.055 pro Gramm Material. Ab 5 Stück erhalten Sie 10 % Mengenrabatt, ab 10 Stück 15 %." },
  { q: "Was ist der Unterschied zwischen FDM- und SLA-Druck?", a: "Beim FDM-Druck wird geschmolzener Kunststoff Schicht für Schicht aufgetragen — ideal für robuste Funktionsteile, Ersatzteile und grössere Bauteile. SLA härtet flüssiges Resin mit Licht aus und erreicht Auflösungen bis 0.025 mm für sehr feine Details und glatte Oberflächen. Wir beraten Sie kostenlos, welches Verfahren für Ihr Bauteil das richtige ist." },
  { q: "Welche Materialien stehen zur Auswahl?", a: "Im FDM-Verfahren drucken wir PLA, PETG, ABS, ASA, TPU und Nylon in über 12 Farben. Für höchste Detailtreue steht im SLA-Verfahren Resin zur Verfügung. Unsicher bei der Materialwahl? Unsere kostenlose KI-Materialberatung im Kalkulator hilft Ihnen weiter." },
  { q: "Wie lange dauert die Lieferung?", a: "Bei geeigneten Aufträgen ist eine Fertigung innerhalb von 48 Stunden möglich. Die tatsächliche Produktions- und Lieferzeit hängt von Material, Auftragsumfang und Auslastung ab. Danach versenden wir mit der Schweizer Post oder DHL innerhalb der Schweiz, was in der Regel 1–2 Werktage dauert. Express-Fertigung ist auf Anfrage möglich, Abholung in Eschlikon TG jederzeit." },
  { q: "Wo befindet sich 3DMuscio?", a: "Unser Standort ist in Eschlikon im Kanton Thurgau, zentral in der Ostschweiz zwischen Winterthur und St. Gallen. Wir fertigen alle Teile lokal in der Schweiz — ohne Zoll und ohne lange Wartezeiten aus dem Ausland. Bestellungen können Sie schweizweit online aufgeben oder direkt vor Ort abholen." },
  { q: "Gibt es eine Mindestbestellmenge?", a: "Nein, bei uns gibt es keine Mindestbestellmenge — wir drucken auch ein einzelnes Teil ab CHF 5.–. Vom Einzelstück über Prototypen bis zur Kleinserie mit reproduzierbaren Parametern ist alles möglich. Ab 5 Stück profitieren Sie zusätzlich von Mengenrabatten." },
  { q: "Welche Dateiformate werden unterstützt?", a: "Wir verarbeiten STL, STEP/STP, 3MF und OBJ bis 500 MB Dateigrösse. Der Online-Kalkulator berechnet Volumen, Gewicht und Preis automatisch aus Ihrer Datei. Eine manuelle Eingabe von Massen ist nicht nötig." },
  { q: "Wie stellen Sie die Qualität sicher?", a: "Jedes Teil wird vor dem Versand visuell und dimensionell geprüft — FDM typisch mit Toleranzen von ±0.1 bis ±0.2 mm. Fehldrucke verlassen unser Haus nicht. Bei Abweichungen drucken wir Ihr Teil kostenlos nach." },
];


const FAQ = () => {
  const resin = useResinEnabled();
  const faqs = resin ? FAQS_ALL : FAQS_ALL.filter((f) => !isResinText(f.q)).map((f) => ({ ...f, a: f.a.replace(" Für höchste Detailtreue steht im SLA-Verfahren Resin zur Verfügung.", "") }));
  return (
  <section className="py-28 relative" id="faq">
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(faqs)) }}
    />
    <div className="container mx-auto px-4 grid grid-cols-1 lg:grid-cols-12 gap-10">
      <div className="lg:col-span-4">
        <div className="lg:sticky lg:top-28">
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-primary">FAQ</p>
          <h2 className="font-heading text-3xl md:text-5xl font-bold tracking-tight mb-5">Häufige Fragen.</h2>
          <p className="text-muted-foreground mb-6 max-w-xs">Noch etwas offen? Wir antworten persönlich und meist am selben Tag.</p>
          <Button asChild variant="outline" className="rounded-md"><Link to="/kontakt">Kontakt aufnehmen</Link></Button>
        </div>
      </div>
      <div className="lg:col-span-8 divide-y divide-border border-y border-border">
        {faqs.map((f, i) => (
          <details key={i} className="group py-5" {...(i === 0 ? { open: true } : {})}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-heading text-lg font-semibold text-foreground [&::-webkit-details-marker]:hidden">
              {f.q}
              <span className="relative h-5 w-5 shrink-0">
                <span className="absolute left-0 top-1/2 h-0.5 w-5 -translate-y-1/2 bg-primary" />
                <span className="absolute left-1/2 top-0 h-5 w-0.5 -translate-x-1/2 bg-primary transition-transform group-open:scale-y-0" />
              </span>
            </summary>
            <p className="mt-3 max-w-2xl text-muted-foreground leading-relaxed">{f.a}</p>
          </details>
        ))}
      </div>
    </div>
  </section>
  );
};

/* ─── CTA ─── */
const CTA = () => (
  <section className="bg-primary text-primary-foreground">
    <Rise className="container mx-auto px-4 py-16 md:py-24 flex flex-col md:flex-row md:items-center md:justify-between gap-8">
      <div className="max-w-2xl">
        <h2 className="font-heading text-3xl md:text-5xl font-bold tracking-tight mb-3">Bereit, dein Teil zu drucken?</h2>
        <p className="text-primary-foreground/80 text-lg">Sofort Preis berechnen – schnelle Fertigung bei geeigneten Aufträgen.</p>
      </div>
      <Button size="lg" asChild className="rounded-md bg-background text-foreground hover:bg-background/90 min-h-[56px] px-9 text-base font-semibold shrink-0">
        <Link to="/kalkulator-online">Jetzt starten <ArrowRight className="w-4 h-4 ml-2" /></Link>
      </Button>
    </Rise>
  </section>
);

/* ─── ENTITY / KURZANTWORT ─── */
const EntityAnswer = () => {
  const resin = useResinEnabled();
  const reviewData = useReviewData();
  return (
  <section className="py-16">
    <div className="container mx-auto px-4 max-w-4xl">
      <ScrollReveal>
        <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
          <h2 className="font-heading text-xl md:text-2xl font-bold mb-3">Was ist 3DMuscio?</h2>
          <p className="text-muted-foreground leading-relaxed">{resin ? company.shortDescription : stripResin(company.shortDescription)}</p>
          <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-3 mt-6 text-sm">
            {[
              ["Standort", fullAddress],
              ["Verfahren", company.processes.filter((p) => resin || !isResinText(p)).join(", ")],
              ["Materialien", company.materials.filter((m) => resin || !isResinText(m)).join(", ")],
              ["Dateiformate", company.fileFormats.join(", ")],
              ["Produktionszeit", company.productionTime],
              ["Mindestmenge", company.minOrder],
              ["Preis", "ab CHF 5.– pro Auftrag, Sofortpreis im Online-Kalkulator"],
              ...(reviewData && reviewData.count > 0
                ? [["Kundenbewertungen", `${reviewData.average.toFixed(1)} von 5 Sternen aus ${reviewData.count} echten Kundenbewertungen`]]
                : []),
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
              { label: "3D-Druck Thurgau", to: "/3d-druck-thurgau" },
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
};

/* ─── SEO CONTENT ─── */

const SEOContent = () => {
  const resin = useResinEnabled();
  return (
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
            {resin && <div>
              <h3 className="font-heading text-lg font-bold text-foreground mb-2">SLA Resin-Druck</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Für höchste Detailgenauigkeit bieten wir SLA Resin-Druck an. Perfekt für Schmuck, Miniaturen, Zahntechnik und filigrane Bauteile mit glatten Oberflächen. Auflösung bis zu 0.025mm für perfekte Ergebnisse bei anspruchsvollsten Projekten.
              </p>
            </div>}
            <div>
              <h3 className="font-heading text-lg font-bold text-foreground mb-2">Schneller Versand in der Schweiz</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Als Schweizer Unternehmen aus Eschlikon TG fertigen wir schnell – bei geeigneten Aufträgen innerhalb von 48 Stunden. Kein Zoll, keine langen Wartezeiten aus dem Ausland. Versand mit Post oder DHL.
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
          schnelle, unkomplizierte Herstellung ohne Mindestbestellmenge. {resin ? "Ob FDM- oder SLA-Druck, ob PLA, PETG, ABS oder Resin" : "Ob PLA, PETG, ABS oder ASA"}, wir finden die passende Lösung für Ihr Projekt.
        </p>
      </ScrollReveal>
    </div>
  </section>
  );
};

const Index = () => {
  return (
  <div>
    <Seo
      title="3D-Druckservice Schweiz – FDM & SLA ab 1 Stück | 3DMuscio"
      description="Schweizer 3D-Druckservice aus Eschlikon TG: FDM und SLA/Resin aus einer Hand, ab 1 Stück, Sofortpreis im Kalkulator, Fertigung bei geeigneten Aufträgen in 48 h möglich."
      path="/"
    />
    <ScrollBar />
    <HeroBento />
    <StatsTrust />
    <StatementReveal
      eyebrow="Unser Anspruch"
      text="Wir raten keine Preise. Jedes Teil wird auf unserer eigenen Slicing-Anlage in der Schweiz durchgerechnet, Schicht für Schicht, damit Zeit, Material und Preis stimmen."
    />
    <Services />
    <HowItWorks />
    <MaterialsTeaser />
    <Werkstatt />
    <ReviewsSection />
    <EntityAnswer />
    <FAQ />
    <CTA />
    <SEOContent />
  </div>
  );
};

export default Index;
