import "server-only";
import { dispatchPushOutbox } from "@/lib/push-dispatcher";

const g = globalThis as typeof globalThis & {
  __carsduelPushTimer?: NodeJS.Timeout;
  __carsduelPushRunning?: boolean;
};

/**
 * Worker intégré au serveur Next.js : draine l'outbox push périodiquement.
 * Désactivable avec PUSH_WORKER=0 si un cron externe appelle /api/push/dispatch.
 */
export function startPushWorker() {
  if (g.__carsduelPushTimer) return;
  if (process.env.PUSH_WORKER === "0") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;

  const parsed = Number(process.env.PUSH_DISPATCH_INTERVAL_MS ?? 60_000);
  const interval = (Number.isFinite(parsed) ? Math.max(parsed, 15_000) : 60_000);

  async function run() {
    if (g.__carsduelPushRunning) return;
    g.__carsduelPushRunning = true;
    try {
      const result = await dispatchPushOutbox({ limit: 50 });
      if (result.sent > 0 || result.failed > 0 || result.remaining > 0) {
        console.log(
          `[push] envoyés=${result.sent} ignorés=${result.skipped} échecs=${result.failed} restants=${result.remaining}`,
        );
      }
    } catch (error) {
      console.error("[push] dispatch impossible :", error);
    } finally {
      g.__carsduelPushRunning = false;
    }
  }

  const timer = setInterval(run, interval);
  timer.unref?.();
  g.__carsduelPushTimer = timer;

  const first = setTimeout(run, 5_000);
  first.unref?.();
}
