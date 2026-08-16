import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const HERKUNFT_OPTIONEN = [
  { value: "Google", label: "Google", emoji: "🔍" },
  { value: "Empfehlung", label: "Empfehlung", emoji: "👥" },
  { value: "LinkedIn", label: "LinkedIn", emoji: "💼" },
  { value: "Instagram", label: "Instagram", emoji: "📸" },
  { value: "KI / ChatGPT", label: "KI / ChatGPT", emoji: "🤖" },
  { value: "Anderes", label: "Anderes", emoji: "✏️" },
];

interface HerkunftBannerProps {
  inquiryId: string;
  onSaved: () => void;
}

export const HerkunftBanner = ({ inquiryId, onSaved }: HerkunftBannerProps) => {
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    sessionStorage.setItem("herkunft_gefragt", "true");
  }, []);

  const handleSelect = async (value: string) => {
    if (selected) return;
    setSelected(value);
    try {
      await supabase.rpc("set_inquiry_herkunft", {
        p_inquiry_id: inquiryId,
        p_herkunft: value,
      });
      setTimeout(() => {
        onSaved();
        toast.success("Danke für Ihr Feedback! 🙏");
      }, 800);
    } catch (e) {
      console.error(e);
      setTimeout(() => {
        onSaved();
        toast.error("Feedback konnte nicht gespeichert werden.");
      }, 800);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: 0.5, ease: "easeOut" }}
      className="w-full rounded-2xl border border-primary/30 bg-primary/10 p-5 md:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="text-xl leading-none">🙏</span>
        <div className="flex-1">
          <h3 className="font-heading text-base font-bold text-foreground">
            Kurze Frage – wie haben Sie uns gefunden?
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Ihr Feedback hilft uns zu wachsen. Nur ein Klick, kein Muss.
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {HERKUNFT_OPTIONEN.map((opt) => {
          const isSelected = selected === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={!!selected}
              onClick={() => handleSelect(opt.value)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                isSelected
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border text-foreground hover:border-primary hover:bg-primary/5"
              } ${selected && !isSelected ? "opacity-50" : ""}`}
            >
              <span className="mr-1.5">{opt.emoji}</span>
              {opt.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onSaved}
          className="text-xs text-muted-foreground underline hover:text-foreground"
        >
          Überspringen
        </button>
      </div>
    </motion.div>
  );
};

export default HerkunftBanner;
