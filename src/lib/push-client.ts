/**
 * Client Web Push (VAPID) — indépendant de React.
 *
 * Le serveur expose :
 *   GET  /api/push/vapid        -> { configured, publicKey }
 *   POST /api/push/subscribe    -> { ok }
 *   POST /api/push/unsubscribe  -> { ok }
 *   POST /api/push/test         -> { sent, failed, skipped }
 *
 * Sur iPhone, le push n'existe que dans la PWA installée (iOS 16.4+).
 */

export interface PushContext {
  ios: boolean;
  standalone: boolean;
  supported: boolean;
  needsInstall: boolean;
  permission: NotificationPermission | "unsupported";
}

export interface PushStatus extends PushContext {
  subscribed: boolean;
  vapidConfigured: boolean;
  enabled: boolean;
}

export interface PushEnableResult {
  ok: boolean;
  reason?: "ios-install" | "unsupported" | "vapid" | "denied" | "error";
  error?: string;
}

export interface PushTestResult {
  sent: number;
  failed?: number;
  skipped?: boolean;
  reason?: string;
}

export interface PushClientOptions {
  apiBase?: string;
  swUrl?: string;
  storageKey?: string;
  fetch?: typeof fetch;
}

export interface PushClient {
  context: () => PushContext;
  status: () => Promise<PushStatus>;
  enable: () => Promise<PushEnableResult>;
  disable: () => Promise<void>;
  sync: () => Promise<void>;
  test: () => Promise<PushTestResult>;
  isEnabled: () => boolean;
}

const SW_URL = "/sw.js";

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }
  return bytes;
}

function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function sameApplicationServerKey(subscription: PushSubscription, publicKey: string): boolean {
  const actual = subscription.options?.applicationServerKey;
  if (!actual) return true;
  const expected = urlBase64ToUint8Array(publicKey);
  const bytes = new Uint8Array(actual);
  if (bytes.length !== expected.length) return false;
  return bytes.every((value, index) => value === expected[index]);
}

export function createPushClient(options: PushClientOptions = {}): PushClient {
  const apiBase = (options.apiBase ?? "/api").replace(/\/+$/, "");
  const swUrl = options.swUrl ?? SW_URL;
  const storageKey = options.storageKey ?? "carsduel_push_enabled";
  const doFetch = options.fetch ?? globalThis.fetch;

  function context(): PushContext {
    const supported =
      typeof navigator !== "undefined" &&
      "serviceWorker" in navigator &&
      typeof window !== "undefined" &&
      "PushManager" in window;
    const permission: NotificationPermission | "unsupported" =
      typeof Notification === "undefined" ? "unsupported" : Notification.permission;
    const ios = isIosDevice();
    const standalone = isStandalone();
    return { ios, standalone, supported, needsInstall: ios && !standalone, permission };
  }

  function isEnabled(): boolean {
    if (typeof localStorage === "undefined") return false;
    return localStorage.getItem(storageKey) === "1";
  }

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await doFetch(`${apiBase}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...((init.headers as Record<string, string> | undefined) ?? {}),
      },
    });

    const data = (await response.json().catch(() => ({}))) as { error?: string } | T;
    if (!response.ok) {
      throw new Error((data as { error?: string }).error ?? `Erreur ${response.status}`);
    }
    return data as T;
  }

  async function vapid(): Promise<{ configured: boolean; publicKey?: string }> {
    return request("/push/vapid");
  }

  async function registration(): Promise<ServiceWorkerRegistration> {
    const existing = await navigator.serviceWorker.getRegistration("/");
    if (existing) {
      await navigator.serviceWorker.ready;
      return existing;
    }

    const created = await navigator.serviceWorker.register(swUrl, { scope: "/" });
    await navigator.serviceWorker.ready;
    return created;
  }

  async function ensureSubscription(
    reg: ServiceWorkerRegistration,
    publicKey: string,
  ): Promise<PushSubscription> {
    let subscription = await reg.pushManager.getSubscription();
    if (!subscription || !sameApplicationServerKey(subscription, publicKey)) {
      if (subscription) await subscription.unsubscribe();
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    }
    return subscription;
  }

  async function status(): Promise<PushStatus> {
    const ctx = context();
    let subscribed = false;
    let vapidConfigured = false;

    if (ctx.supported && ctx.permission === "granted") {
      try {
        const reg = await navigator.serviceWorker.getRegistration("/");
        subscribed = Boolean(await reg?.pushManager?.getSubscription());
      } catch {
        subscribed = false;
      }
    }

    try {
      vapidConfigured = Boolean((await vapid()).configured);
    } catch {
      vapidConfigured = false;
    }

    return { ...ctx, subscribed, vapidConfigured, enabled: isEnabled() };
  }

  async function enable(): Promise<PushEnableResult> {
    const ctx = context();
    if (ctx.needsInstall) return { ok: false, reason: "ios-install" };
    if (!ctx.supported) return { ok: false, reason: "unsupported" };

    try {
      const keys = await vapid();
      if (!keys.configured || !keys.publicKey) return { ok: false, reason: "vapid" };

      const permission = await Notification.requestPermission();
      if (permission !== "granted") return { ok: false, reason: "denied" };

      const reg = await registration();
      const subscription = await ensureSubscription(reg, keys.publicKey);

      await request("/push/subscribe", {
        method: "POST",
        body: JSON.stringify(subscription.toJSON()),
      });

      localStorage.setItem(storageKey, "1");
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        reason: "error",
        error: error instanceof Error ? error.message : "Abonnement impossible.",
      };
    }
  }

  async function disable(): Promise<void> {
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const subscription = await reg?.pushManager?.getSubscription();
      if (subscription) {
        await request("/push/unsubscribe", {
          method: "POST",
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        }).catch(() => {});
        await subscription.unsubscribe();
      }
    } catch {
      // On désactive quand même côté navigateur.
    } finally {
      localStorage.removeItem(storageKey);
    }
  }

  async function sync(): Promise<void> {
    const ctx = context();
    if (ctx.needsInstall || !ctx.supported) return;
    if (ctx.permission !== "granted") {
      localStorage.removeItem(storageKey);
      return;
    }

    // Le drapeau local peut avoir été effacé alors que l'abonnement navigateur
    // existe encore : on resynchronise quand même pour ne pas perdre l'appareil.
    if (!isEnabled()) {
      const existing = await navigator.serviceWorker.getRegistration("/");
      const subscription = await existing?.pushManager?.getSubscription().catch(() => null);
      if (!subscription) return;
      localStorage.setItem(storageKey, "1");
    }

    try {
      const keys = await vapid();
      if (!keys.configured || !keys.publicKey) return;
      const reg = await registration();
      const subscription = await ensureSubscription(reg, keys.publicKey);
      await request("/push/subscribe", {
        method: "POST",
        body: JSON.stringify({ ...subscription.toJSON(), quiet: true }),
      });
    } catch {
      // Silencieux : la prochaine ouverture réessaiera.
    }
  }

  async function test(): Promise<PushTestResult> {
    return request("/push/test", { method: "POST" });
  }

  return { context, status, enable, disable, sync, test, isEnabled };
}
