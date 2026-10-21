import { useEffect, useState } from "react";
import { Link } from "@/lib/router-compat";

/** Eiszapfen, die von der Menüleiste herunterhängen (klickdurchlässig). */
const ICICLES: [number, number][] = [
  [0, 14], [3, 24], [6, 10], [9, 30], [12, 16], [15, 22], [18, 9], [21, 28], [24, 15], [27, 20],
  [30, 11], [33, 26], [36, 17], [39, 32], [42, 12], [45, 22], [48, 9], [51, 27], [54, 16], [57, 30],
  [60, 13], [63, 24], [66, 10], [69, 28], [72, 18], [75, 23], [78, 9], [81, 31], [84, 15], [87, 21],
  [90, 12], [93, 27], [96, 17], [99, 22],
];
export function SnowDrift() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 102 36"
      preserveAspectRatio="none"
      className="pointer-events-none absolute left-0 top-full h-6 w-full md:h-8"
      style={{ filter: "drop-shadow(0 1px 1px rgba(60,90,120,0.35))" }}
    >
      <rect x="0" y="0" width="102" height="3" fill="#fff" />
      {ICICLES.map(([x, h]) => (
        <path key={x} d={`M${x} 2 L${x + 3} 2 L${x + 1.5} ${h} Z`} fill="#e8f4fb" stroke="#fff" strokeWidth="0.35" />
      ))}
    </svg>
  );
}

// Modulweite Merker: gelten nur bis zum nächsten vollständigen Neuladen der Website,
// nicht beim Seitenwechsel innerhalb der Website.
let snowmanClosed = false;
let snowmanPlayed = false;

/** Schneemann, der seitlich hereinguckt und zur Weihnachtsseite führt. */
export function Snowman() {
  const [hidden, setHidden] = useState(snowmanClosed);
  const [animate] = useState(!snowmanPlayed);

  useEffect(() => {
    snowmanPlayed = true;
  }, []);

  if (hidden) return null;
  const close = () => {
    snowmanClosed = true;
    setHidden(true);
  };

  return (
    <div className="pointer-events-none fixed bottom-24 left-0 z-[55] hidden md:block">
      <div className={`${animate ? "xmas-snowman" : ""} relative flex items-end`}>
        <svg viewBox="0 0 120 150" className="h-44 w-36 -ml-14 -rotate-6 drop-shadow-md" aria-hidden="true">
          <ellipse cx="60" cy="146" rx="52" ry="8" fill="#fff" />
          <circle cx="60" cy="112" r="34" fill="#fff" stroke="#d6e0ea" strokeWidth="1.5" />
          <circle cx="60" cy="66" r="25" fill="#fff" stroke="#d6e0ea" strokeWidth="1.5" />
          <circle cx="60" cy="100" r="3" fill="#2b2b2b" />
          <circle cx="60" cy="114" r="3" fill="#2b2b2b" />
          <circle cx="60" cy="128" r="3" fill="#2b2b2b" />
          <circle cx="51" cy="61" r="3" fill="#222" />
          <circle cx="69" cy="61" r="3" fill="#222" />
          <path d="M60 67l16 4-16 3z" fill="#f08a24" />
          <path d="M50 74q10 8 20 0" stroke="#222" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <path d="M36 84q24 10 48 0l-2 9q-22 8 -44 0z" fill="#c0272d" />
          <rect x="32" y="40" width="56" height="5" rx="2" fill="#222" />
          <rect x="42" y="18" width="36" height="24" rx="3" fill="#222" />
          <rect x="42" y="33" width="36" height="5" fill="#c0272d" />
          <g className={animate ? "xmas-arm" : undefined}>
            <path d="M88 100l24-22M106 84l8-4M108 90l9 1" stroke="#6b4a2b" strokeWidth="3" strokeLinecap="round" fill="none" />
          </g>
          <path d="M32 102l-22 14" stroke="#6b4a2b" strokeWidth="3" strokeLinecap="round" fill="none" />
        </svg>
        <div className="pointer-events-auto relative mb-24 -ml-6 w-44 rounded-xl border border-border bg-white p-3 text-sm shadow-lg">
          <button
            type="button"
            onClick={close}
            aria-label="Schliessen"
            className="absolute right-1.5 top-1 text-xs text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
          <span className="absolute -left-1.5 bottom-4 h-3 w-3 rotate-45 border-b border-l border-border bg-white" />
          <p className="pr-3 font-semibold leading-snug text-foreground">Ho ho ho! 🎁</p>
          <Link to="/weihnachtsgeschenke" className="mt-1 block font-medium leading-snug text-primary hover:underline">
            Weihnachtsgeschenke jetzt bestellen →
          </Link>
        </div>
      </div>
    </div>
  );
}
