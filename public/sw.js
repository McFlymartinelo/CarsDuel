/* CarsDuel — service worker Web Push.
 *
 * Pas de cache applicatif : Next.js gère ses assets. Ce worker sert uniquement
 * à afficher les notifications hors app et à ramener le joueur dans la PWA.
 *
 * Payload attendu :
 *   { title, body, url, tag, kind, icon, badge, actions: [{ action, title }], data }
 */

const DEFAULT_TITLE = "CarsDuel";
const DEFAULT_BODY = "Nouvelle notification";
const DEFAULT_URL = "/";
const ICON = "/icons/icon-192.png";
const BADGE = "/icons/favicon-32.png";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Présence d'un handler fetch : critère d'installabilité de la PWA.
self.addEventListener("fetch", () => {
  // Réseau direct.
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
