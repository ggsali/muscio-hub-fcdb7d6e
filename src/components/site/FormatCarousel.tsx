import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FileText, DraftingCompass, Package, Box } from "lucide-react";

const FORMATS = [
  { ext: ".STL", label: "Standard CAD-Format", icon: FileText },
  { ext: ".STEP", label: "Präzise Geometrie", icon: DraftingCompass },
  { ext: ".3MF", label: "Mit Material & Farbe", icon: Package },
  { ext: ".OBJ", label: "Universelles Format", icon: Box },
];

export const FormatCarousel = () => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % FORMATS.length);
    }, 2000);
    return () => clearInterval(id);
  }, []);

  const current = FORMATS[index];
  const Icon = current.icon;

  return (
    <div className="w-full max-w-[300px] mx-auto">
      <div className="relative h-[72px] rounded-2xl border border-border/70 bg-card/60 backdrop-blur-sm overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={current.ext}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 flex flex-col items-center justify-center text-center px-4"
          >
            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4 text-primary" />
              <span className="font-heading text-sm font-bold text-foreground">
                {current.ext}
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground mt-0.5">
              {current.label}
            </span>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-center gap-1.5 mt-2.5">
        {FORMATS.map((f, i) => (
          <span
            key={f.ext}
            className={`block rounded-full transition-all duration-300 ${
              i === index
                ? "w-4 h-1.5 bg-primary"
                : "w-1.5 h-1.5 bg-border"
            }`}
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  );
};
