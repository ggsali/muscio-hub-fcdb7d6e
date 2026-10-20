import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@/lib/router-compat";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { ArrowUpRight } from "lucide-react";

const GREEN = "hsl(156 100% 46%)";

/** true ab Desktop-Breite (Scroll-Pinning nur dort, mobil läuft alles normal) */
export function useIsDesktop() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setDesktop(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return desktop;
}

/** Dünner Lesefortschritt oben am Bildschirmrand */
export function ScrollBar() {
  const { scrollYProgress } = useScroll();
  const x = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.3 });
  return (
    <motion.div
      aria-hidden
      className="fixed left-0 right-0 top-0 z-[70] h-[3px] origin-left"
      style={{ scaleX: x, background: GREEN }}
    />
  );
}

/* ───────────────────────── Hero: Bauteil wird Schicht für Schicht gedruckt ───────────────────────── */

const LAYERS = 48;
const LAYER_H = 6;
const BASE_Y = 392;

function widthAt(i: number) {
  const t = i / (LAYERS - 1);
  return 150 + 112 * Math.sin(Math.PI * t * 0.92 + 0.28);
}

function Layer({ i, progress }: { i: number; progress: MotionValue<number> }) {
  const from = i / LAYERS;
  const opacity = useTransform(progress, [from - 0.012, from + 0.004], [0, 1]);
  const scaleX = useTransform(progress, [from - 0.012, from + 0.02], [0.6, 1]);
  const w = widthAt(i);
  const light = 30 + (i / LAYERS) * 22;
  return (
    <motion.rect
      x={210 - w / 2}
      y={BASE_Y - (i + 1) * (LAYER_H + 1)}
      width={w}
      height={LAYER_H}
      rx={1.5}
      fill={`hsl(156 85% ${light}%)`}
      style={{ opacity, scaleX, transformOrigin: "210px 0px", transformBox: "fill-box" as never }}
    />
  );
}

export function PrintVisual({ progress }: { progress: MotionValue<number> }) {
  const nozzleY = useTransform(progress, (v) => BASE_Y - Math.min(LAYERS, Math.ceil(v * LAYERS) + 1) * (LAYER_H + 1) - 12);
  const nozzleX = useTransform(progress, (v) => {
    const idx = Math.min(LAYERS - 1, Math.max(0, Math.ceil(v * LAYERS)));
    return 210 + (widthAt(idx) / 2 - 8) * Math.sin(v * 90);
  });
  const layerTxt = useTransform(progress, (v) => `${String(Math.round(v * 1180)).padStart(4, "0")} / 1180`);
  const timeTxt = useTransform(progress, (v) => `${(v * 15.2).toFixed(1)} h`);
  const gramTxt = useTransform(progress, (v) => `${Math.round(v * 425)} g`);
  const priceTxt = useTransform(progress, (v) => `CHF ${(v * 50.72).toFixed(2)}`);
  const doneOpacity = useTransform(progress, [0.94, 1], [0, 1]);

  return (
    <div className="relative rounded-lg border border-background/15 bg-background/[0.04] p-5 md:p-6">
      <div className="mb-3 flex items-center justify-between text-xs font-medium uppercase tracking-[0.14em] text-background/55">
        <span>Beispiel · Gehäuse_Lite3</span>
        <motion.span style={{ opacity: doneOpacity, color: GREEN }}>✓ Gesliced</motion.span>
      </div>

      <svg viewBox="0 0 420 420" className="mx-auto block w-full max-w-[440px]" role="img" aria-label="Bauteil wird Schicht für Schicht gedruckt">
        {/* Druckbett */}
        <line x1="40" y1={BASE_Y + 2} x2="380" y2={BASE_Y + 2} stroke="hsl(0 0% 100% / 0.35)" strokeWidth="2" />
        {Array.from({ length: 9 }).map((_, k) => (
          <line key={k} x1={60 + k * 40} y1={BASE_Y + 6} x2={50 + k * 40} y2={BASE_Y + 16} stroke="hsl(0 0% 100% / 0.18)" />
        ))}
        {Array.from({ length: LAYERS }).map((_, i) => (
          <Layer key={i} i={i} progress={progress} />
        ))}
        {/* Düse */}
        <motion.g style={{ x: nozzleX, y: nozzleY }}>
          <polygon points="-9,-22 9,-22 4,0 -4,0" fill="hsl(0 0% 100%)" />
          <rect x="-12" y="-34" width="24" height="12" rx="2" fill="hsl(0 0% 100% / 0.85)" />
        </motion.g>
      </svg>

      <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-background/15 bg-background/15 text-sm sm:grid-cols-4">
        {[
          ["Schicht", layerTxt],
          ["Druckzeit", timeTxt],
          ["Filament", gramTxt],
          ["Preis", priceTxt],
        ].map(([k, v]) => (
          <div key={k as string} className="bg-foreground px-3 py-2.5">
            <div className="text-[11px] uppercase tracking-wider text-background/45">{k as string}</div>
            <motion.div className="font-heading font-semibold tabular-nums text-background">{v as MotionValue<string>}</motion.div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Scroll-Fortschritt eines hohen Pin-Abschnitts, geglättet. Mobil/Reduced Motion: sofort fertig. */
export function usePinnedProgress(ref: React.RefObject<HTMLElement | null>, from = 0.04, to = 0.86) {
  const desktop = useIsDesktop();
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const mapped = useTransform(scrollYProgress, [from, to], [0, 1], { clamp: true });
  const smooth = useSpring(mapped, { stiffness: 110, damping: 28, mass: 0.5 });
  const fixed = useMotionValue(1);
  const live = desktop && !reduce;
  return { progress: live ? smooth : fixed, raw: scrollYProgress, live };
}

/* ───────────────────────── Aussage: Wörter füllen sich beim Scrollen ───────────────────────── */

function Word({ children, range, progress }: { children: string; range: [number, number]; progress: MotionValue<number> }) {
  const opacity = useTransform(progress, range, [0.16, 1]);
  return (
    <motion.span style={{ opacity }} className="mr-[0.28em] inline-block">
      {children}
    </motion.span>
  );
}

export function StatementReveal({ text, eyebrow }: { text: string; eyebrow: string }) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.55"] });
  const p = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 });
  const fixed = useMotionValue(1);
  const prog = reduce ? fixed : p;
  const words = text.split(" ");
  return (
    <section ref={ref} className="py-28 md:py-44">
      <div className="container mx-auto px-4">
        <p className="mb-8 text-[13px] font-semibold uppercase tracking-[0.14em] text-primary">{eyebrow}</p>
        <p className="max-w-5xl font-heading text-3xl font-semibold leading-[1.15] tracking-tight text-foreground md:text-6xl">
          {words.map((w, i) => (
            <Word key={i} progress={prog} range={[i / words.length, Math.min(1, (i + 1.6) / words.length)]}>
              {w}
            </Word>
          ))}
        </p>
      </div>
    </section>
  );
}

/* ───────────────────────── Leistungen: horizontales Scrollen ───────────────────────── */

export interface ServiceItem { t: string; d: string; to: string }

export function ServicesHorizontal({ items }: { items: ServiceItem[] }) {
  const ref = useRef<HTMLElement>(null);
  const desktop = useIsDesktop();
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const smooth = useSpring(scrollYProgress, { stiffness: 100, damping: 30, mass: 0.5 });
  const cardVw = desktop ? 30 : 78;
  const gap = 2;
  const pad = desktop ? 8 : 6;
  const shift = Math.max(0, items.length * cardVw + (items.length - 1) * gap + 2 * pad - 100);
  const x = useTransform(smooth, [0, 1], ["0vw", `-${shift}vw`]);
  const bar = useTransform(smooth, [0, 1], [0, 1]);

  const card = (it: ServiceItem, i: number) => (
    <Link
      key={it.t}
      to={it.to}
      className="group relative flex shrink-0 flex-col justify-between rounded-lg border border-border bg-card p-7 no-underline transition-colors hover:border-primary md:p-9"
      style={{ width: `${cardVw}vw`, minHeight: desktop ? "52vh" : "320px" }}
    >
      <div>
        <span className="mb-6 block font-heading text-6xl font-bold tabular-nums text-primary/20 transition-colors group-hover:text-primary/60">
          0{i + 1}
        </span>
        <h3 className="mb-3 font-heading text-2xl font-semibold md:text-3xl">{it.t}</h3>
        <p className="max-w-sm text-muted-foreground leading-relaxed">{it.d}</p>
      </div>
      <span className="mt-8 inline-flex items-center gap-1 text-sm font-semibold text-primary">
        Mehr erfahren <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </span>
    </Link>
  );

  // Mobil / reduzierte Bewegung: normale, seitlich wischbare Liste ohne Pinning
  if (!desktop || reduce) {
    return (
      <section ref={ref} className="py-20">
        <div className="container mx-auto px-4">
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-primary">Leistungen</p>
          <h2 className="mb-8 font-heading text-3xl font-bold tracking-tight md:text-5xl">Was wir für Sie fertigen.</h2>
        </div>
        <div className="flex snap-x gap-4 overflow-x-auto px-4 pb-4 [&>a]:snap-start">{items.map(card)}</div>
      </section>
    );
  }

  return (
    <section ref={ref} className="relative" style={{ height: `${160 + items.length * 55}vh` }}>
      <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden pt-24">
        <div className="container mx-auto mb-10 px-4">
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-primary">Leistungen</p>
          <h2 className="font-heading text-4xl font-bold tracking-tight md:text-6xl">Was wir für Sie fertigen.</h2>
        </div>
        <motion.div className="flex items-stretch will-change-transform" style={{ x, gap: `${gap}vw`, paddingLeft: `${pad}vw`, paddingRight: `${pad}vw` }}>
          {items.map(card)}
        </motion.div>
        <div className="container mx-auto mt-10 px-4">
          <div className="h-[3px] w-full bg-border">
            <motion.div className="h-full origin-left bg-primary" style={{ scaleX: bar }} />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Ablauf: Schritte laufen beim Scrollen mit ───────────────────────── */

export interface ProcessStep { title: string; desc: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }

function StepRow({ step, i }: { step: ProcessStep; i: number }) {
  const ref = useRef<HTMLLIElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.9", "start 0.45"] });
  const o = useTransform(scrollYProgress, [0, 1], [0.15, 1]);
  const x = useTransform(scrollYProgress, [0, 1], [60, 0]);
  const num = useTransform(scrollYProgress, [0, 1], ["hsl(200 14% 80%)", "hsl(156 100% 28%)"]);
  return (
    <li ref={ref} className="flex min-h-[42vh] items-center border-t border-border py-10 first:border-t-0">
      <motion.div style={{ opacity: o, x }} className="grid w-full grid-cols-[auto_1fr] items-start gap-6 md:gap-10">
        <motion.span style={{ color: num }} className="font-heading text-6xl font-bold tabular-nums md:text-8xl">
          0{i + 1}
        </motion.span>
        <div className="pt-2 md:pt-5">
          <step.icon className="mb-4 h-7 w-7 text-primary" strokeWidth={2} />
          <h3 className="mb-2 font-heading text-2xl font-semibold md:text-4xl">{step.title}</h3>
          <p className="max-w-md text-muted-foreground leading-relaxed">{step.desc}</p>
        </div>
      </motion.div>
    </li>
  );
}

export function ProcessSticky({ steps }: { steps: ProcessStep[] }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.6", "end 0.7"] });
  const line = useSpring(scrollYProgress, { stiffness: 100, damping: 30, mass: 0.4 });
  return (
    <section ref={ref} className="bg-muted py-20 md:py-32">
      <div className="container mx-auto grid grid-cols-1 gap-10 px-4 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-32">
            <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-primary">Ablauf</p>
            <h2 className="font-heading text-3xl font-bold tracking-tight md:text-6xl">Vom Modell zum Bauteil in vier Schritten.</h2>
            <div className="mt-10 hidden h-1 w-full max-w-xs bg-border lg:block">
              <motion.div className="h-full origin-left bg-primary" style={{ scaleX: line }} />
            </div>
          </div>
        </div>
        <ol className="lg:col-span-7">
          {steps.map((s, i) => (
            <StepRow key={s.title} step={s} i={i} />
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ───────────────────────── Kleine Helfer ───────────────────────── */

/** Blendet Inhalt beim Eintritt weich ein (leicht von unten), mit optionaler Verzögerung */
export function Rise({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
