import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Lightbulb } from "lucide-react";

/** Wartezeit-Überbrückung im Kalkulator: wechselnde, kurze Fakten rund um den 3D-Druck. */
const FACTS: string[] = [
  "Dein Teil wird gerade in Schichten zerlegt. Eine Schicht ist oft nur 0.2 mm dick, etwa so dünn wie zwei Blätter Papier.",
  "Der Slicer berechnet jeden Weg der Düse. Für ein mittleres Teil sind das mehrere hunderttausend Einzelbefehle.",
  "Eine 1-kg-Rolle PLA enthält rund 330 Meter Filament. Daraus entstehen je nach Teil Dutzende bis Hunderte Bauteile.",
  "PLA wird aus nachwachsenden Rohstoffen wie Maisstärke oder Zuckerrohr hergestellt.",
  "Im Inneren ist ein Teil meist nicht massiv: Ein Gitter-Muster (Infill) von 15 bis 20 % macht es leicht und trotzdem stabil.",
  "Überhänge steiler als etwa 45° brauchen Stützen, sonst hängt das Material beim Drucken durch.",
  "Die Lage im Drucker entscheidet über die Festigkeit: Zwischen den Schichten ist ein Teil am schwächsten.",
  "Die Düse ist beim Drucken von PLA rund 200 °C heiss, das Druckbett etwa 60 °C warm.",
  "3D-Druck gibt es seit den 1980er-Jahren: Chuck Hull erfand 1983 die Stereolithografie und gründete später 3D Systems.",
  "Raketentriebwerke und Flugzeugteile enthalten heute 3D-gedruckte Bauteile, weil sich so Formen bauen lassen, die man nicht fräsen kann.",
  "Je dünner die Schichten, desto glatter die Oberfläche. Dafür dauert der Druck länger.",
  "Bei 3D-Druck kostet eine komplizierte Form kaum mehr als eine einfache. Entscheidend sind Material und Druckzeit.",
  "Dein Teil wird in Eschlikon TG gedruckt und von Hand geprüft, bevor es zu dir kommt.",
];

export function WaitFacts({ intervalMs = 7000 }: { intervalMs?: number }) {
  const [i, setI] = useState(() => Math.floor(Math.random() * FACTS.length));
  useEffect(() => {
    const t = window.setInterval(() => setI((x) => (x + 1) % FACTS.length), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return (
    <div className="mt-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5" aria-live="polite">
      <div className="flex items-start gap-2">
        <Lightbulb className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
        <div className="min-h-[3.2rem]">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary mb-0.5">Wusstest du?</p>
          <AnimatePresence mode="wait">
            <motion.p
              key={i}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.3 }}
              className="text-xs text-foreground/80 leading-snug"
            >
              {FACTS[i]}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
