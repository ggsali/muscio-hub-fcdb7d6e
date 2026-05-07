import React, { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface FaqEntry { frage: string; antwort: string; }

const fallback: FaqEntry[] = [
  { frage: "Wie lange dauert der 3D-Druck?", antwort: "Standard 48 Stunden ab Auftragsbestätigung. Express auf Anfrage möglich." },
  { frage: "Welche Dateiformate akzeptiert ihr?", antwort: "STL, STEP, 3MF und OBJ. Für Anfragen reicht meist eine STL-Datei." },
  { frage: "Wie genau sind die Drucke?", antwort: "Toleranzen typisch ±0.2 mm. Bei höheren Anforderungen sprich uns an." },
  { frage: "Was kostet ein Druck?", antwort: "Online im Preisrechner direkt kalkulieren – Material, Zeit und Nachbearbeitung sind transparent ausgewiesen." },
];

export default function FaqPage() {
  const [items, setItems] = useState<FaqEntry[]>(fallback);
  const [open, setOpen] = useState<number | null>(0);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("website_settings").select("value").eq("key", "faq").maybeSingle();
      const e = (data?.value as any)?.eintraege as FaqEntry[] | undefined;
      if (e?.length) setItems(e);
    })();
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-12 md:py-16">
      <h1 className="text-3xl md:text-4xl font-bold mb-2">Häufige Fragen</h1>
      <p className="text-muted-foreground mb-10">Wir haben zusammengefasst, was am häufigsten gefragt wird.</p>

      <div className="space-y-3">
        {items.map((it, i) => (
          <div key={i} className="bg-card border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30"
            >
              <span className="font-medium">{it.frage}</span>
              <ChevronDown className={cn("w-4 h-4 transition-transform", open === i && "rotate-180")} />
            </button>
            {open === i && (
              <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{it.antwort}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
