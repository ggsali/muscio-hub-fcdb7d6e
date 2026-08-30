import { useLayoutEffect } from "react";
import { useLocation } from "@/lib/router-compat";

export function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useLayoutEffect(() => {
    // Browser-eigene Scroll-Wiederherstellung deaktivieren
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    if (hash) {
      // Anker-Navigation: Ziel-Element anspringen (nach dem Rendern)
      const id = hash.slice(1);
      const t = window.setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 120);
      return () => window.clearTimeout(t);
    }

    const toTop = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    toTop();
    // Nochmals nach dem ersten Paint – falls Bilder/Animationen das Layout verschieben
    const raf = requestAnimationFrame(toTop);
    const t = window.setTimeout(toTop, 80);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, [pathname, hash]);

  return null;
}
