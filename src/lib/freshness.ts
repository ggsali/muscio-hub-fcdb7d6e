// Erkennt, ob der Browser eine veraltete Version der Website anzeigt
// (z. B. durch HTTP-Cache oder alte Service Worker) und lädt einmalig neu.

const RELOAD_FLAG = "app-reloaded-for-update";

const currentEntryScript = (): string | null => {
  const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>("script[src]"));
  const entry = scripts.find((s) => /\/assets\/index-.*\.js$/.test(s.src) || s.src.includes("/src/main.tsx"));
  return entry ? new URL(entry.src, location.origin).pathname : null;
};

const remoteEntryScript = async (): Promise<string | null> => {
  const res = await fetch(`/?_=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) return null;
  const html = await res.text();
  const match = html.match(/src="(\/assets\/index-[^"]+\.js)"/) || html.match(/src="(\/src\/main\.tsx[^"]*)"/);
  return match ? match[1].split("?")[0] : null;
};

const check = async () => {
  try {
    const local = currentEntryScript();
    if (!local) return;
    const remote = await remoteEntryScript();
    if (!remote || remote === local) {
      sessionStorage.removeItem(RELOAD_FLAG);
      return;
    }
    if (sessionStorage.getItem(RELOAD_FLAG)) return; // Reload-Loop verhindern
    sessionStorage.setItem(RELOAD_FLAG, "1");

    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations().catch(() => []);
      await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
    }
    if ("caches" in window) {
      const keys = await caches.keys().catch(() => [] as string[]);
      await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)));
    }
    location.replace(location.pathname + location.search + location.hash);
  } catch {
    // Netzwerkfehler ignorieren
  }
};

export const startFreshnessWatcher = () => {
  if (import.meta.env.DEV) return;
  check();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") check();
  });
  window.setInterval(check, 5 * 60 * 1000);
};
