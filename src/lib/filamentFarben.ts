/** Farbnamen eines Filaments aus der Bibliothek (farben-Liste, sonst die Einzelfarbe) */
export function filamentFarben(fil: { farben?: unknown; farbe?: string | null } | null | undefined): { name: string; hex: string }[] {
  if (!fil) return [];
  const raw = Array.isArray(fil.farben) ? (fil.farben as any[]) : [];
  const list = raw
    .map((c) => (typeof c === "string" ? { name: c, hex: c.startsWith("#") ? c : "" } : { name: String(c?.name ?? ""), hex: String(c?.hex ?? "") }))
    .filter((c) => c.name.trim());
  if (list.length === 0 && fil.farbe) list.push({ name: fil.farbe, hex: fil.farbe.startsWith("#") ? fil.farbe : "" });
  return list;
}

/** Passt der Wunsch (z. B. "Schwarz") zu einer Farbe der Bibliothek? Gibt den Namen aus der Bibliothek zurück. */
export function passendeFarbe(fil: { farben?: unknown; farbe?: string | null } | null | undefined, wunsch: string | null | undefined): string | null {
  const w = (wunsch ?? "").trim().toLowerCase();
  if (!w) return null;
  return filamentFarben(fil).find((c) => c.name.trim().toLowerCase() === w)?.name ?? null;
}
