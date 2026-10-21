import { useEffect, useRef } from "react";

/**
 * Schneepfad am rechten Rand: Beim Herunterscrollen räumt ein kleiner Schneepflug
 * den Weg frei. Oben ist der Pfad geräumt, unten liegt noch Schnee. Nur Desktop.
 */
export function SnowPath() {
  const cleared = useRef<HTMLDivElement>(null);
  const plow = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      if (cleared.current) cleared.current.style.height = `${p * 100}%`;
      if (plow.current) plow.current.style.top = `${p * 100}%`;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed bottom-24 right-1 top-28 z-[54] hidden w-4 md:block"
    >
      {/* Schnee */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 30% 20%, #fff 0 45%, #eef5fa 70%), #fff",
          boxShadow: "0 0 0 1px #dbe8f1, 0 1px 4px rgba(60,90,120,0.25)",
          backgroundSize: "100% 14px",
        }}
      />
      {/* Geräumter Weg */}
      <div
        ref={cleared}
        className="absolute left-0 top-0 w-full overflow-hidden rounded-t-full"
        style={{
          height: "0%",
          background: "linear-gradient(90deg, #8b8f94, #b4b8bc 50%, #8b8f94)",
          boxShadow: "inset 0 0 3px rgba(0,0,0,0.35)",
        }}
      >
        <div className="h-full w-px translate-x-[7px] opacity-60" style={{ background: "repeating-linear-gradient(#fff 0 6px, transparent 6px 12px)" }} />
      </div>
      {/* Pflug mit Schneehaufen */}
      <div ref={plow} className="absolute left-1/2 -translate-x-1/2" style={{ top: "0%", transition: "top 0.08s linear" }}>
        <svg viewBox="0 0 44 40" className="-ml-5 -mt-1 h-10 w-11 drop-shadow" style={{ transform: "translateY(-2px)" }}>
          <ellipse cx="22" cy="34" rx="18" ry="5" fill="#fff" />
          <circle cx="14" cy="28" r="8" fill="#fff" stroke="#dbe8f1" />
          <circle cx="27" cy="26" r="9" fill="#fff" stroke="#dbe8f1" />
          <circle cx="21" cy="19" r="6" fill="#fff" stroke="#dbe8f1" />
          <rect x="16" y="2" width="12" height="9" rx="2" fill="#c0272d" />
          <rect x="18" y="4" width="8" height="4" rx="1" fill="#bfe0f2" />
        </svg>
      </div>
    </div>
  );
}
