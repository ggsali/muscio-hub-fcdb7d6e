import { useEffect, useState } from "react";
import { Link } from "@/lib/router-compat";
import { useChristmasMode } from "@/hooks/useChristmasMode";

/** Realistische Eiszapfen: unregelmässig, spitz zulaufend, glasig mit Glanzlicht (klickdurchlässig). */
const rnd = (() => { let t = 7; return () => ((t = (t * 16807) % 2147483647) / 2147483647); })();
const ICICLES = (() => {
  const out: { x: number; w: number; h: number }[] = [];
  let x = 6;
  while (x < 1440) {
    const big = rnd() > 0.72;
    const w = big ? 14 + rnd() * 8 : 6 + rnd() * 7;
    const h = big ? 38 + rnd() * 22 : 10 + rnd() * 24;
    out.push({ x, w, h });
    x += w * (0.7 + rnd() * 0.9) + 2;
  }
  return out;
})();

export function SnowDrift() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1440 64"
      preserveAspectRatio="none"
      className="pointer-events-none absolute left-0 top-0 z-10 h-5 w-full md:h-6"
      style={{ filter: "drop-shadow(0 2px 2px rgba(40,80,120,0.28))" }}
    >
      <defs>
        <linearGradient id="ice-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.98" />
          <stop offset="0.55" stopColor="#d4ecf9" stopOpacity="0.9" />
          <stop offset="1" stopColor="#a9d6ee" stopOpacity="0.75" />
        </linearGradient>
      </defs>
      {ICICLES.map(({ x, w, h }, i) => {
        const l = x - w / 2, r = x + w / 2, tip = x + (rnd() - 0.5) * 2;
        const d = `M${l} 0 C${l + 0.5} ${h * 0.45}, ${x - w * 0.14} ${h * 0.78}, ${tip} ${h} C${x + w * 0.14} ${h * 0.78}, ${r - 0.5} ${h * 0.45}, ${r} 0 Z`;
        return (
          <g key={i}>
            <path d={d} fill="url(#ice-g)" stroke="#bfe0f2" strokeWidth="0.6" />
            <path
              d={`M${l + w * 0.28} ${h * 0.08} C${l + w * 0.26} ${h * 0.4}, ${x - w * 0.1} ${h * 0.62}, ${x - w * 0.03} ${h * 0.82}`}
              stroke="#fff"
              strokeOpacity="0.95"
              strokeWidth={Math.max(1, w * 0.12)}
              strokeLinecap="round"
              fill="none"
            />
          </g>
        );
      })}
      {/* Schneekante oben */}
      <path
        d="M0 0H1440V5C1400 9 1380 3 1340 6S1270 10 1230 5 1160 3 1120 7 1050 10 1010 5 940 3 900 7 830 10 790 5 720 3 680 7 610 10 570 5 500 3 460 7 390 10 350 5 280 3 240 7 170 10 130 5 60 3 0 7Z"
        fill="#fff"
      />
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

/** Lichterkette, die oben in einem Abschnitt hängt (nur im Weihnachtsmodus). Abschnitt braucht `relative`. */
const BULBS = ["#ff4d4d", "#ffd23f", "#3ddc84", "#4da3ff", "#ff8fd0"];
export function XmasLights() {
  const on = useChristmasMode();
  if (!on) return null;
  const swags = 8;
  const w = 1440 / swags;
  let path = "M0 6";
  const bulbs: { x: number; y: number; c: string; i: number }[] = [];
  for (let s = 0; s < swags; s++) {
    const x0 = s * w;
    path += ` Q${x0 + w / 2} 44 ${x0 + w} 6`;
    for (let b = 1; b <= 5; b++) {
      const t = b / 6;
      const x = x0 + w * t;
      const y = (1 - t) * (1 - t) * 6 + 2 * (1 - t) * t * 44 + t * t * 6;
      bulbs.push({ x, y, c: BULBS[(s * 5 + b) % BULBS.length], i: s * 5 + b });
    }
  }
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1440 70"
      preserveAspectRatio="none"
      className="pointer-events-none absolute left-0 top-0 z-10 h-10 w-full md:h-14"
    >
      <path d={path} fill="none" stroke="#2a2a2a" strokeWidth="1.6" />
      {bulbs.map(({ x, y, c, i }) => (
        <g key={i} className="xmas-bulb" style={{ animationDelay: `${(i % 5) * 0.4}s`, color: c }}>
          <rect x={x - 2} y={y} width="4" height="4" fill="#2a2a2a" />
          <ellipse cx={x} cy={y + 9} rx="4.2" ry="6" fill="currentColor" />
          <ellipse cx={x} cy={y + 9} rx="9" ry="11" fill="currentColor" opacity="0.18" />
          <ellipse cx={x - 1.3} cy={y + 7} rx="1" ry="2" fill="#fff" opacity="0.7" />
        </g>
      ))}
    </svg>
  );
}
