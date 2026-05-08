export const COLOR_MAP: Record<string, string> = {
  "Weiss": "#ffffff",
  "Schwarz": "#1a1a1a",
  "Grau": "#9ca3af",
  "Rot": "#ef4444",
  "Blau": "#3b82f6",
  "Grün": "#22c55e",
  "Gelb": "#eab308",
  "Orange": "#f97316",
  "Lila": "#a855f7",
  "Pink": "#ec4899",
  "Braun": "#92400e",
  "Beige": "#d4b896",
  "Transparent": "#e5e7eb",
  "Silber": "#c0c0c0",
  "Gold": "#ffd700",
  "Natürlich": "#f5f0e8",
};

export const colorHex = (name: string): string => COLOR_MAP[name] || "#cccccc";
