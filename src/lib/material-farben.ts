import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { colorHex } from "@/lib/colorMap";

export interface MaterialFarbe {
  name: string;
  hex: string;
}

/**
 * Farbnamen in der Filamentbibliothek sind teils als Hexwert gespeichert
 * ("#000000") oder der Hexwert fehlt – beides wird hier normalisiert, damit
 * auf der Website immer Name + Farbpunkt steht.
 */
export const baueFarbenMap = (rows: any[]): Record<string, MaterialFarbe[]> => {
  const map: Record<string, MaterialFarbe[]> = {};
  (rows ?? []).forEach((f: any) => {
    const key = String(f.material || "").toUpperCase();
    const list =
      Array.isArray(f.farben) && f.farben.length
        ? f.farben
        : f.farbe
          ? [{ name: f.farbe, hex: "" }]
          : [];
    list.forEach((c: any) => {
      let name = String(typeof c === "string" ? c : c?.name ?? "").trim();
      let hex = String(typeof c === "string" ? "" : c?.hex ?? "");
      if (!name) return;
      if (/^#[0-9a-f]{3,8}$/i.test(name)) {
        hex = hex || name;
        name = "";
      } else name = name.replace(/^#/, "");
      if (!hex) hex = colorHex(name);
      if (!name)
        name =
          hex.toLowerCase() === "#000000"
            ? "Schwarz"
            : hex.toLowerCase() === "#ffffff"
              ? "Weiss"
              : hex;
      map[key] = map[key] || [];
      if (!map[key].some((x) => x.name.toLowerCase() === name.toLowerCase()))
        map[key].push({ name, hex });
    });
  });
  return map;
};

/** Farben pro Material – synchronisiert mit der Filamentbibliothek. */
export const useMaterialFarben = () => {
  const [map, setMap] = useState<Record<string, MaterialFarbe[]>>({});

  useEffect(() => {
    let aktiv = true;
    (async () => {
      const { data } = await supabase
        .from("filaments")
        .select("material, farbe, farben")
        .eq("aktiv", true);
      if (aktiv) setMap(baueFarbenMap(data ?? []));
    })();
    return () => {
      aktiv = false;
    };
  }, []);

  /** "ABS/ASA" mixt die Farben beider Einträge. */
  const farbenFor = (name: string): MaterialFarbe[] => {
    const keys = name.toUpperCase().split("/").map((s) => s.trim());
    const out: MaterialFarbe[] = [];
    keys.forEach((k) =>
      (map[k] ?? []).forEach((c) => {
        if (!out.some((x) => x.name.toLowerCase() === c.name.toLowerCase())) out.push(c);
      }),
    );
    return out;
  };

  return { farbenFor };
};
