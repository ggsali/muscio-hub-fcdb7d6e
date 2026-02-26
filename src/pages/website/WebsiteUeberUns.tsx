import { ScrollReveal } from "@/components/ScrollReveal";
import werkstattImg from "@/assets/werkstatt.jpg";
import { Shield, Zap, Leaf, Printer, Settings, Cpu, MapPin, Phone, Mail, Clock } from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

const values = [
  { icon: Shield, title: "Qualität", desc: "Jeder Druck durchläuft strenge Qualitätskontrolle. Wir liefern nur, was uns selbst überzeugt." },
  { icon: Zap, title: "Schnelligkeit", desc: "48h von Bestellung bis Lieferung. Express-Optionen für eilige Projekte verfügbar." },
  { icon: Leaf, title: "Nachhaltigkeit", desc: "Recycelbare Materialien, energieeffiziente Drucker. Weniger Abfall, mehr Zukunft." },
];

const printers = [
  { icon: Printer, title: "FDM Farm", specs: "8× Prusa MK4, 24/7 Betrieb", capabilities: "PLA, PETG, ABS, ASA, TPU — bis 250×210×220mm" },
  { icon: Settings, title: "SLA Drucker", specs: "2× Formlabs Form 3+", capabilities: "Resin Standard, ABS-like, Flexible — 0.025mm Präzision" },
  { icon: Cpu, title: "Industrial FDM", specs: "1× Bambu Lab X1 Carbon", capabilities: "Nylon, Carbon-Fiber, ASA — bis 256×256×256mm" },
];

const WebsiteUeberUns = () => {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 80]);

  return (
    <div className="pt-24 pb-16 bg-[#0a0a0a] min-h-screen">
      <div className="container mx-auto px-4">
        <div ref={heroRef} className="mb-28">
          <motion.div style={{ y: heroY }}>
            <ScrollReveal>
              <div className="max-w-xl mb-8">
                <p className="text-xs font-medium text-[#00cc66] uppercase tracking-widest mb-3">Über uns</p>
                <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4">
                  Wir machen 3D-Druck<br />zugänglich.
                </h1>
                <p className="text-white/50 text-base leading-relaxed">Schweizer Qualität trifft modernste Technologie — seit 2021.</p>
              </div>
            </ScrollReveal>
          </motion.div>
        </div>

        <ScrollReveal>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-28 max-w-5xl mx-auto">
            <div className="md:col-span-5">
              <img src={werkstattImg} alt="Unsere Werkstatt" className="rounded-xl aspect-[3/4] object-cover w-full sticky top-24" />
            </div>
            <div className="md:col-span-7 md:pl-4">
              <span className="text-xs font-bold text-white/30 tracking-widest block mb-6">UNSERE GESCHICHTE</span>
              <h2 className="text-2xl font-bold text-white mb-6 tracking-tight">Von einem Drucker zu einer Flotte.</h2>
              <div className="space-y-5 text-white/50 text-sm leading-relaxed">
                <p>2021 starteten wir mit einem einzigen FDM-Drucker und einer einfachen Idee: professionellen 3D-Druck für alle zugänglich machen — ohne Mindestbestellmengen, ohne komplizierte Prozesse.</p>
                <p>Heute betreiben wir eine wachsende Flotte aus FDM- und SLA-Druckern in der Schweiz. Jeder Auftrag wird von unserem Team persönlich betreut — von der Dateiprüfung bis zur Endkontrolle.</p>
                <p>Unser Fokus liegt auf Geschwindigkeit und Qualität. 48 Stunden Lieferzeit ist kein Marketing — es ist unser Standard.</p>
              </div>
            </div>
          </div>
        </ScrollReveal>

        <div className="mb-28">
          <ScrollReveal>
            <div className="mb-10">
              <p className="text-xs font-medium text-[#00cc66] uppercase tracking-widest mb-3">Werte</p>
              <h2 className="text-3xl font-bold text-white tracking-tight">Wofür wir stehen.</h2>
            </div>
          </ScrollReveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {values.map((v, i) => (
              <ScrollReveal key={i} delay={i * 0.08}>
                <motion.div className="bg-[#111] rounded-xl p-6 border border-white/8 hover:border-[#00cc66]/30 transition-colors" whileHover={{ y: -2 }}>
                  <div className="w-10 h-10 rounded-lg bg-[#00cc66]/10 flex items-center justify-center mb-4">
                    <v.icon className="w-5 h-5 text-[#00cc66]" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-2">{v.title}</h3>
                  <p className="text-white/50 text-sm leading-relaxed">{v.desc}</p>
                </motion.div>
              </ScrollReveal>
            ))}
          </div>
        </div>

        <div className="mb-28">
          <ScrollReveal>
            <div className="mb-10">
              <p className="text-xs font-medium text-[#00cc66] uppercase tracking-widest mb-3">Equipment</p>
              <h2 className="text-3xl font-bold text-white tracking-tight">Unsere Druckerflotte.</h2>
            </div>
          </ScrollReveal>
          <div className="space-y-4 max-w-3xl">
            {printers.map((p, i) => (
              <ScrollReveal key={i} delay={i * 0.08}>
                <div className="flex gap-5 items-start bg-[#111] rounded-xl p-5 border border-white/8 group hover:border-[#00cc66]/30 transition-colors">
                  <span className="text-2xl font-extrabold text-white/10 leading-none mt-1 select-none">{String(i + 1).padStart(2, "0")}</span>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-white mb-1">{p.title}</h3>
                    <p className="text-xs text-[#00cc66] font-medium mb-1">{p.specs}</p>
                    <p className="text-white/50 text-sm">{p.capabilities}</p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                    <p.icon className="w-5 h-5 text-white/30 group-hover:text-[#00cc66] transition-colors" />
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>

        <ScrollReveal>
          <div className="bg-[#111] rounded-xl border border-white/8 p-6 md:p-8 max-w-3xl">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg bg-[#00cc66]/10 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-[#00cc66]" />
              </div>
              <h2 className="text-lg font-bold text-white">Standort</h2>
            </div>
            <div className="bg-white/5 rounded-lg aspect-[2.5/1] flex items-center justify-center mb-5">
              <p className="text-white/30 text-xs">Gartensiedlung 13, 8360 Eschlikon TG</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-white/50">
              <span className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5" /> Gartensiedlung 13, 8360 Eschlikon TG</span>
              <span className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" /> +41 44 123 45 67</span>
              <span className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" /> info@3dmuscio.ch</span>
              <span className="flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> Mo–Fr: 08:00–18:00</span>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
};

export default WebsiteUeberUns;
