/** Kategorien, bei denen eine Rechnung auf einen Zeitraum verteilt werden kann (Abgrenzung) */
export const VERTEILBAR = ["raumaufwand", "versicherungen"];

const ymd = (s: string) => {
  const m = /^(\d{4})-(\d{2})/.exec(s);
  return m ? { y: parseInt(m[1], 10), m: parseInt(m[2], 10) } : null;
};

/** Anzahl Kalendermonate von..bis (beide inklusive, angefangene Monate zählen voll) */
export function monateZwischen(von: string, bis: string): number {
  const a = ymd(von), b = ymd(bis);
  if (!a || !b) return 0;
  return (b.y - a.y) * 12 + (b.m - a.m) + 1;
}

/** Verteilt einen Betrag gleichmässig pro Monat auf Kalenderjahre. Summe stimmt auf den Rappen. */
export function verteile(betrag: number, von: string, bis: string): Map<number, number> | null {
  const a = ymd(von);
  const monate = monateZwischen(von, bis);
  if (!a || monate < 1) return null;
  const proJahr = new Map<number, number>();
  let y = a.y, m = a.m;
  for (let i = 0; i < monate; i++) {
    proJahr.set(y, (proJahr.get(y) || 0) + 1);
    if (++m > 12) { m = 1; y++; }
  }
  const jahre = [...proJahr.keys()].sort((x, z) => x - z);
  const out = new Map<number, number>();
  let rest = Math.round(betrag * 100);
  jahre.forEach((j, idx) => {
    const cents = idx === jahre.length - 1 ? rest : Math.round((betrag * 100 * proJahr.get(j)!) / monate);
    out.set(j, cents / 100);
    rest -= cents;
  });
  return out;
}
