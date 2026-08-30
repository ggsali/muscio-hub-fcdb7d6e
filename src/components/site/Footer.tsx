import { Link } from "@/lib/router-compat";
import { Mail, Phone, MapPin, ArrowUpRight, Printer } from "lucide-react";
import { motion } from "framer-motion";
import logo from "@/assets/logo.jpeg";

const footerLinks = [
  { label: "Kalkulator", path: "/kalkulator-online" },
  { label: "Leistungen", path: "/leistungen" },
  { label: "Materialien", path: "/materialien" },
  { label: "3D-Druck Kosten", path: "/wissen/3d-druck-kosten-schweiz" },
  { label: "Vergleiche", path: "/vergleich" },
  { label: "3D-Druck Thurgau", path: "/standorte/thurgau" },
  { label: "Unsere Maschinen", path: "/maschinen" },
  { label: "Über uns", path: "/ueber-uns" },
  { label: "Blog", path: "/blog" },
  { label: "Kontakt", path: "/kontakt" },
];

const materials = [
  { label: "PLA", path: "/materialien/pla" },
  { label: "PETG", path: "/materialien/petg" },
  { label: "ABS", path: "/materialien/abs" },
  { label: "ASA", path: "/materialien/asa" },
  { label: "TPU", path: "/materialien/tpu" },
  { label: "Resin", path: "/materialien/resin" },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
};

export const Footer = () => (
  <footer className="border-t border-border bg-background relative overflow-hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}>
    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] bg-primary/[0.04] rounded-full blur-[80px] pointer-events-none" />

    <div className="container mx-auto px-4 py-16 relative z-10">
      <motion.div
        className="grid grid-cols-1 md:grid-cols-4 gap-10"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        variants={containerVariants}
      >
        <motion.div variants={itemVariants} className="md:col-span-1">
          <Link to="/" className="flex items-center gap-2.5 mb-4 group w-fit">
            <div className="relative">
              <img
                src={logo}
                alt="3DMuscio 3D-Druck Schweiz"
                className="h-10 w-10 object-contain rounded-xl shadow-md ring-1 ring-border group-hover:ring-primary/40 transition-all duration-300"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-heading text-base font-extrabold tracking-tight text-foreground">
                3D<span className="text-primary">Muscio</span>
              </span>
              <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-medium">
                3D-Druck Schweiz
              </span>
            </div>
          </Link>

          <p className="text-muted-foreground text-sm leading-relaxed mb-5">
            Professioneller 3D-Druckservice aus der Schweiz, präzise, schnell und transparent.
          </p>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-muted/40 text-xs text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Aufträge offen — 48h Lieferzeit
          </div>
        </motion.div>

        <motion.div variants={itemVariants}>
          <h4 className="font-heading font-semibold text-xs mb-4 text-foreground uppercase tracking-widest">Navigation</h4>
          <div className="flex flex-col gap-2">
            {footerLinks.map((l) => (
              <Link
                key={l.path}
                to={l.path}
                className="group flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
              >
                <span>{l.label}</span>
                <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity -translate-y-0.5" />
              </Link>
            ))}
          </div>
        </motion.div>

        <motion.div variants={itemVariants}>
          <h4 className="font-heading font-semibold text-xs mb-4 text-foreground uppercase tracking-widest">Materialien</h4>
          <div className="flex flex-col gap-2">
            {materials.map((m) => (
              <Link
                key={m.path}
                to={m.path}
                className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
              >
                <span className="w-1 h-1 rounded-full bg-border group-hover:bg-primary transition-colors" />
                {m.label}
              </Link>
            ))}
          </div>
        </motion.div>

        <motion.div variants={itemVariants}>
          <h4 className="font-heading font-semibold text-xs mb-4 text-foreground uppercase tracking-widest">Kontakt</h4>
          <div className="flex flex-col gap-3">
            <a
              href="https://maps.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors group"
            >
              <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary/60 group-hover:text-primary transition-colors" />
              <span>Gartensiedlung 13<br />8360 Eschlikon TG</span>
            </a>
            <a href="tel:+41798395080" className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors group">
              <Phone className="w-3.5 h-3.5 shrink-0 text-primary/60 group-hover:text-primary transition-colors" />
              +41 79 839 50 80
            </a>
            <a href="mailto:info@3dmuscio.com" className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors group">
              <Mail className="w-3.5 h-3.5 shrink-0 text-primary/60 group-hover:text-primary transition-colors" />
              info@3dmuscio.com
            </a>
          </div>
        </motion.div>
      </motion.div>

      <motion.div
        className="border-t border-border mt-12 pt-6 flex flex-col md:flex-row items-center justify-between gap-4"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Printer className="w-3.5 h-3.5 text-primary/50" />
          <span>© {new Date().getFullYear()} 3DMuscio. Alle Rechte vorbehalten.</span>
        </div>
        <div className="flex gap-5">
          {[
            { label: "Impressum", path: "/impressum" },
            { label: "Datenschutz", path: "/datenschutz" },
            { label: "AGB", path: "/agb" },
          ].map((l) => (
            <Link key={l.path} to={l.path} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              {l.label}
            </Link>
          ))}
        </div>
      </motion.div>
    </div>
  </footer>
);
