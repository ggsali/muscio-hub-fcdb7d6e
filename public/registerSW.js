// Frühere Builds laden diese Datei noch. Keine neue PWA registrieren.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations
      .filter((registration) => registration.active?.scriptURL.endsWith("/sw.js"))
      .forEach((registration) => registration.unregister());
  });
}