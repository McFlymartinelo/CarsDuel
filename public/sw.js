/* CarsDuel — service worker : Web Push + cache statique minimal.
 *
 * Le cache ne concerne que des ressources publiques (coquille hors-ligne,
 * icônes, logo, manifest, images et assets compilés). Les réponses /api, les
 * pages authentifiées et les données joueur ne sont jamais mises en cache.
 *
 * Payload push attendu :
 *   { title, body, url, tag, kind, icon, badge, actions: [{ action, title }], data }
 */

const CACHE_PREFIX = "carsduel-";
const STATIC_CACHE = `${CACHE_PREFIX}static-v1`;
const ASSET_CACHE = `${CACHE_PREFIX}assets-v1`;
const KEEP_CACHES = new Set([STATIC_CACHE, ASSET_CACHE]);

const PRECACHE = [
  "/offline.html",
  "/logo.svg",
  "/manifest.webmanifest",
  "/icons/favicon-32.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-192-maskable.png",
  "/icons/icon-512-maskable.png",
  "/icons/apple-touch-icon.png",
];

const DEFAULT_TITLE = "CarsDuel";
const DEFAULT_BODY = "Nouvelle notification";
const DEFAULT_URL = "/";
const ICON = "/icons/icon-192.png";
const BADGE = "/icons/favicon-32.png";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      // Une ressource manquante ne doit pas empêcher l'installation du worker.
      await Promise.allSettled(PRECACHE.map((url) => cache.add(url)));
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && !KEEP_CACHES.has(name))
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

/** Mise à jour déclenchée par l'application, jamais automatiquement. */
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

function isPrivateRequest(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/_next/data/")
  );
}

function isCacheableAsset(request, url) {
  if (request.method !== "GET") return false;
  if (request.headers.get("RSC") === "1") return false;
  if (isPrivateRequest(url)) return false;
  if (url.pathname.startsWith("/_next/static/")) return true;
  if (["style", "script", "font", "image"].includes(request.destination)) return true;
  return ["/logo.svg", "/manifest.webmanifest", "/offline.html"].includes(url.pathname);
}

async function staleWhileRevalidate(event, request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      if (response.ok && response.type === "basic") {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    })
    .catch(() => cached);

  if (cached) {
    event.waitUntil(network.catch(() => {}));
    return cached;
  }
  return network;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Uniquement le même domaine ; les requêtes RSC et mutations passent au réseau.
  if (url.origin !== self.location.origin) return;
  if (request.method !== "GET") return;

  if (request.mode === "navigate") {
    // Réseau d'abord : une page authentifiée n'est jamais servie depuis le cache.
    event.respondWith(
      fetch(request).catch(async () => {
        const offline = await caches.match("/offline.html");
        return (
          offline ??
          new Response("<h1>CarsDuel est hors ligne</h1>", {
            status: 503,
            headers: { "content-type": "text/html; charset=utf-8" },
          })
        );
      }),
    );
    return;
  }

  if (isCacheableAsset(request, url)) {
    event.respondWith(staleWhileRevalidate(event, request));
  }
});

function parsePayload(event) {
  const fallback = { title: DEFAULT_TITLE, body: DEFAULT_BODY, url: DEFAULT_URL };
  if (!event.data) return fallback;

  try {
    return { ...fallback, ...JSON.parse(event.data.text()) };
  } catch {
    return { ...fallback, body: event.data.text() || fallback.body };
  }
}

function sameAppClient(client) {
  try {
    return new URL(client.url).origin === new URL(self.registration.scope).origin;
  } catch {
    return false;
  }
}

async function notifyOpenClients(payload) {
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of clients) {
    if (sameAppClient(client)) {
      client.postMessage({ type: "CARDSDUEL_PUSH", payload });
    }
  }
}

async function showNotification(data) {
  const options = {
    body: data.body || DEFAULT_BODY,
    tag: data.tag || `carsduel-${Date.now()}`,
    icon: data.icon || ICON,
    badge: data.badge || BADGE,
    data: {
      url: data.url || DEFAULT_URL,
      kind: data.kind || null,
      ...(data.data || {}),
    },
  };

  if (Array.isArray(data.actions) && data.actions.length > 0) {
    options.actions = data.actions.slice(0, 2);
  }
  if (data.silent) options.silent = true;

  await self.registration.showNotification(data.title || DEFAULT_TITLE, options);
}

self.addEventListener("push", (event) => {
  const data = parsePayload(event);

  event.waitUntil(
    (async () => {
      try {
        await showNotification(data);
      } catch {
        await self.registration.showNotification(data.title || DEFAULT_TITLE, {
          body: data.body || DEFAULT_BODY,
          icon: ICON,
          data: { url: data.url || DEFAULT_URL },
        });
      }
      await notifyOpenClients(data);
    })(),
  );
});

// L'abonnement a tourné côté navigateur : l'app doit se réabonner côté serveur.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (sameAppClient(client)) {
          client.postMessage({ type: "CARDSDUEL_PUSH_RESUBSCRIBE" });
        }
      }
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = new URL(data.url || DEFAULT_URL, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const appClients = clients.filter(sameAppClient);

      if (appClients.length > 0) {
        const client = appClients[0];
        await client.focus();
        try {
          await client.navigate(url);
        } catch {
          client.postMessage({ type: "CARDSDUEL_NAV", payload: { ...data, url } });
        }
        return;
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(url);
      }
    })(),
  );
});
