import "server-only";
import webpush from "web-push";
import { withAdmin } from "@/lib/db";
import { pwaIcon } from "@/lib/pwa-icons";

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  kind?: string;
  amount?: number;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
}

export interface PushError {
  endpoint: string;
  status?: number;
  message: string;
}

export interface PushSendResult {
  sent: number;
  failed: number;
  skipped: boolean;
  reason?: "vapid" | "no-subscriptions";
  errors?: PushError[];
}

export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

interface SubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Clés VAPID lues dans l'environnement. `null` si le push n'est pas configuré. */
export function getVapidConfig(): VapidConfig | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  return {
    publicKey,
    privateKey,
    subject: process.env.VAPID_SUBJECT?.trim() || "mailto:admin@carsduel.app",
  };
}

let configuredKey: string | null = null;

function configureWebPush(): VapidConfig | null {
  const config = getVapidConfig();
  if (!config) {
    configuredKey = null;
    return null;
  }

  const key = `${config.subject}|${config.publicKey}|${config.privateKey}`;
  if (configuredKey !== key) {
    webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
    configuredKey = key;
  }
  return config;
}

/** Envoie une notification à tous les appareils abonnés d'un joueur. */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<PushSendResult> {
  if (!configureWebPush()) {
    return { sent: 0, failed: 0, skipped: true, reason: "vapid" };
  }

  const subscriptions = await withAdmin(async (c) => {
    const { rows } = await c.query<SubscriptionRow>(
      `select endpoint, p256dh, auth
         from public.push_subscriptions
        where user_id = $1`,
      [userId],
    );
    return rows;
  });

  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0, skipped: true, reason: "no-subscriptions" };
  }

  const body = JSON.stringify({
    icon: pwaIcon("icon-192.png"),
    badge: pwaIcon("favicon-32.png"),
    ...payload,
    url: payload.url ?? "/",
  });

  let sent = 0;
  let failed = 0;
  const errors: PushError[] = [];

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        body,
        { TTL: 86_400, urgency: "high" },
      );
      sent += 1;
    } catch (error) {
      failed += 1;
      const status = (error as { statusCode?: number }).statusCode;
      const message = error instanceof Error ? error.message : "Envoi impossible";
      errors.push({
        endpoint: subscription.endpoint.slice(0, 48),
        status,
        message,
      });

      // Abonnement mort ou clé VAPID devenue invalide : on le retire.
      if (status === 403 || status === 404 || status === 410) {
        await withAdmin((c) =>
          c.query("delete from public.push_subscriptions where endpoint = $1", [
            subscription.endpoint,
          ]),
        ).catch(() => {});
      }
    }
  }

  return { sent, failed, skipped: false, errors: errors.length > 0 ? errors : undefined };
}
