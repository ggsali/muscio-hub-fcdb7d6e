import { useEffect, useState } from "react";
import { Link } from "@/lib/router-compat";

/** Schneehaufen entlang der Menüleiste (liegt unter dem Header, klickdurchlässig). */
export function SnowDrift() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1440 28"
      preserveAspectRatio="none"
      className="pointer-events-none absolute left-0 top-full h-5 w-full md:h-7"
      style={{ filter: "drop-shadow(0 2px 2px rgba(60,90,120,0.22))" }}
    >
      <path
        fill="#fff"
        d="M0 0h1440v6c-30 0-45 14-85 14s-52-9-92-9-48 14-95 14-60-12-104-12-52 11-96 11-58-14-100-14-58 13-104 13-50-10-92-10-60 14-104 14-56-12-98-12-52 11-92 11-60-13-104-13-56 11-98 11-50-9-90-9-52 10-90 10-50-8-86-8-40 8-60 8z"
      />
    </svg>
  );
}

/** Schneemann, der unten links hochploppt und zur Weihnachtsseite führt. */
export function Snowman() {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      setHidden(sessionStorage.getItem("xmas-snowman-closed") === "1");
    } catch {
      setHidden(false);
    }
  }, []);

  if (hidden) return null;
  const close = () => {
    setHidden(true);
    try { sessionStorage.setItem("xmas-snowman-closed", "1"); } catch { /* ignore */ }
  };

  return (
    <div className="pointer-events-none fixed bottom-0 left-3 z-[55] hidden md:block">
      <div className="xmas-snowman relative flex items-end">
        <svg viewBox="0 0 120 150" className="h-36 w-28 drop-shadow-md" aria-hidden="true">
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
          <g className="xmas-arm">
            <path d="M88 100l24-22M106 84l8-4M108 90l9 1" stroke="#6b4a2b" strokeWidth="3" strokeLinecap="round" fill="none" />
          </g>
          <path d="M32 102l-22 14" stroke="#6b4a2b" strokeWidth="3" strokeLinecap="round" fill="none" />
        </svg>
        <div className="pointer-events-auto relative mb-20 -ml-2 w-44 rounded-xl border border-border bg-white p-3 text-sm shadow-lg">
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
