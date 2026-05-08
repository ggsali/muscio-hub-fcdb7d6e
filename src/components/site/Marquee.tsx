import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_ITEMS = [
  "PLA", "PETG", "ABS", "TPU", "Resin", "Nylon", "ASA", "Carbon-Fiber",
  "48h Lieferung", "0.1mm Präzision", "Swiss Made", "100+ Kunden",
];

export const Marquee = () => {
  const [items, setItems] = useState<string[]>(DEFAULT_ITEMS);

  useEffect(() => {
    const loadItems = async () => {
      const { data: materialsData } = await supabase
        .from("materials")
        .select("name")
        .eq("aktiv", true)
        .order("sort_order");

      const { data: settingsData } = await supabase
        .from("website_settings")
        .select("value")
        .eq("key", "karussel")
        .maybeSingle();

      const materialNames = (materialsData || []).map((m: any) => m.name);
      const customItems = ((settingsData?.value as any)?.items || []).map((i: any) => i.text);

      if (materialNames.length > 0 || customItems.length > 0) {
        setItems([...materialNames, ...customItems]);
      }
    };
    loadItems();
  }, []);

  return (
    <div className="relative overflow-hidden py-4 border-y border-border bg-muted/50">
      <div className="marquee-track flex gap-8 w-max">
        {[...items, ...items].map((item, i) => (
          <span key={i} className="text-sm font-medium text-muted-foreground whitespace-nowrap flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
};
