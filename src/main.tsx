import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { startFreshnessWatcher } from "./lib/freshness";

const removeLegacyPwaData = async () => {
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(registrations.map((registration) => registration.unregister()));
  }

  if ("caches" in window) {
    const cacheNames = await caches.keys();
    await Promise.allSettled(cacheNames.map((name) => caches.delete(name)));
  }
};

void removeLegacyPwaData();

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root-Element wurde nicht gefunden");
}

createRoot(rootElement).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);

// Prüft laufend, ob eine neuere Version deployed wurde, und lädt dann automatisch neu
startFreshnessWatcher();

