// Einmaliger Abschalt-Worker für frühere PWA-Versionen.
// Diese Datei muss für mindestens einen Release-Zyklus unter /sw.js erreichbar bleiben.

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        // CacheStorage ist bereits pro Origin isoliert. Deshalb bewusst alle alten
        // Caches löschen – auch solche mit abweichenden Workbox-Namensmustern.
        await Promise.allSettled(cacheNames.map((name) => caches.delete(name)));
        await self.clients.claim();
        const windowClients = await self.clients.matchAll({ type: "window" });
        await Promise.allSettled(
          windowClients.map((client) => {
            const url = new URL(client.url);
            url.searchParams.set("_fresh", Date.now().toString(36));
            return client.navigate(url.toString());
          }),
        );
      } finally {
        await self.registration.unregister();
      }
    })(),
  ),
);