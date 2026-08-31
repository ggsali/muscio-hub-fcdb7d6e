import { useEffect, useState, useRef } from "react";
import { useInView } from "framer-motion";

export const CountUp = ({
  end,
  suffix = "",
  prefix = "",
  duration = 2000,
  decimals = 0,
}: {
  end: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  decimals?: number;
}) => {
  // SSR + erster Render: Zielwert steht direkt im HTML (für Crawler).
  const [count, setCount] = useState(end);
  const [hydrated, setHydrated] = useState(false);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const hasRun = useRef(false);

  // Nach der Hydration auf 0 zurücksetzen, damit die Animation sichtbar ist.
  useEffect(() => {
    setHydrated(true);
    setCount(0);
  }, []);

  useEffect(() => {
    if (!hydrated || !inView || hasRun.current) return;
    hasRun.current = true;
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      if (elapsed >= duration) {
        setCount(end);
        clearInterval(timer);
      } else {
        const progress = elapsed / duration;
        const eased = 1 - Math.pow(1 - progress, 3);
        setCount(Number((eased * end).toFixed(decimals)));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [hydrated, inView, end, duration, decimals]);

  return (
    <span ref={ref}>
      {prefix}{decimals > 0 ? count.toFixed(decimals) : count}{suffix}
    </span>
  );
};
