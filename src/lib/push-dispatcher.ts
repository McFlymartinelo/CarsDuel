import "server-only";
import { withAdmin } from "@/lib/db";
import { getVapidConfig, sendPushToUser } from "@/lib/push";

const MAX_ATTEMPTS = 6;
const CLAIM_SECONDS = 120;
const STALE_HOURS = 24;

interface OutboxRow {
  id: number;
  user_id: string;
  kind: string;
  title: string;
  body: string;
  url: string;
  tag: string | null;
  amount: number;
  attempts: number;
  created_at: string;
}

export interface DispatchResult {
  due: number;
  sent: number;
  skipped: number;
  failed: number;
  remaining: number;
  vapid?: boolean;
}

/**
 * Réclame puis envoie les événements en attente de l'outbox.
 *
 * Le claim (`for update skip locked`) est committé avant les appels réseau :
 * deux workers ne peuvent pas envoyer le même événement et aucune transaction
 * n'est maintenue ouverte pendant un appel HTTP.
 */
export async function dispatchPushOutbox({ limit = 100 }: { limit?: number } = {}): Promise<DispatchResult> {
  if (!getVapidConfig()) {
    return { due: 0, sent: 0, skipped: 0, failed: 0, remaining: 0, vapid: true };
  }

  const rows = await withAdmin(async (c) => {
    const { rows } = await c.query<OutboxRow>(
      `with claimed as (
         select id
           from public.push_outbox
          where sent_at is null
            and available_at <= now()
            and attempts < $2
          order by id
          limit $1
          for update skip locked
       )
       update public.push_outbox o
          set attempts = o.attempts + 1,
              available_at = now() + make_interval(secs => $3)
         from claimed
        where o.id = claimed.id
       returning o.id, o.user_id, o.kind, o.title, o.body, o.url, o.tag,
                 o.amount, o.attempts, o.created_at`,
      [limit, MAX_ATTEMPTS, CLAIM_SECONDS],
    );
    return rows;
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const ageHours = (Date.now() - new Date(row.created_at).getTime()) / 3_600_000;

    if (ageHours > STALE_HOURS) {
      await markSent(row.id, "expired");
      skipped += 1;
      continue;
    }

    try {
      const result = await sendPushToUser(row.user_id, {
        title: row.title,
        body: row.body,
        url: row.url,
        tag: row.tag ?? undefined,
        kind: row.kind,
        amount: row.amount,
        data: { outboxId: row.id, kind: row.kind },
      });

      if (result.sent > 0) {
        await markSent(row.id, result.failed > 0 ? "partial" : null);
        sent += 1;
        continue;
      }

      if (result.skipped) {
        // Aucun abonnement au moment de l'événement : inutile de rejouer plus tard.
        await markSent(row.id, result.reason ?? "skipped");
        skipped += 1;
        continue;
      }

      await retryLater(row, result.errors?.[0]?.message ?? "Aucun appareil joint");
      failed += 1;
    } catch (error) {
      await retryLater(row, error instanceof Error ? error.message : "Erreur inconnue");
      failed += 1;
    }
  }

  const remaining = await withAdmin(async (c) => {
    const { rows } = await c.query<{ n: number }>(
      `select count(*)::int as n
         from public.push_outbox
        where sent_at is null and attempts < $1`,
      [MAX_ATTEMPTS],
    );
    return rows[0]?.n ?? 0;
  });

  // Purge opportuniste : l'outbox ne doit pas devenir un journal permanent.
  await withAdmin((c) =>
    c.query("delete from public.push_outbox where sent_at < now() - interval '30 days'"),
  ).catch(() => {});

  return { due: rows.length, sent, skipped, failed, remaining };
}

async function markSent(id: number, error: string | null) {
  await withAdmin((c) =>
    c.query("update public.push_outbox set sent_at = now(), last_error = $2 where id = $1", [id, error]),
  );
}

async function retryLater(row: OutboxRow, error: string) {
  if (row.attempts >= MAX_ATTEMPTS) {
    await markSent(row.id, error.slice(0, 500));
    return;
  }

  // Backoff progressif : 1, 2, 4, 8… minutes.
  const seconds = Math.min(3_600, 60 * 2 ** Math.max(0, row.attempts - 1));
  await withAdmin((c) =>
    c.query(
      `update public.push_outbox
          set available_at = now() + make_interval(secs => $2),
              last_error = $3
        where id = $1 and sent_at is null`,
      [row.id, seconds, error.slice(0, 500)],
    ),
  );
}
