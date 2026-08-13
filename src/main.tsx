import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { startFreshnessWatcher } from "./lib/freshness";

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);

// Alte Service Worker + Caches entfernen (verhindert, dass eine alte Version angezeigt wird)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((reg) => reg.unregister());
  });
}
if ("caches" in window) {
  caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
}

// Prüft laufend, ob eine neuere Version deployed wurde, und lädt dann automatisch neu
startFreshnessWatcher();

