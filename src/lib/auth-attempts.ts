import type { PoolClient } from "pg";

/**
 * Rate limiting d'authentification en base (`auth_attempts`).
 * Fonctions prenant un `PoolClient` : testables hors du contexte Next.
 */

export async function countAuthAttempts(
  c: PoolClient,
  kind: string,
  key: string,
  window: string,
): Promise<number> {
  const { rows } = await c.query<{ n: number }>(
    `select count(*)::int as n from auth_attempts
      where kind = $1 and key = $2 and created_at > now() - $3::interval`,
    [kind, key, window],
  );
  return rows[0]?.n ?? 0;
}

export async function recordAuthAttempt(
  c: PoolClient,
  kind: string,
  key: string,
  at: Date = new Date(),
): Promise<void> {
  await c.query("insert into auth_attempts (kind, key, created_at) values ($1, $2, $3)", [kind, key, at]);
}

export async function clearAuthAttempts(c: PoolClient, kind: string, key: string): Promise<void> {
  await c.query("delete from auth_attempts where kind = $1 and key = $2", [kind, key]);
}

/** Vrai si le plafond est déjà atteint pour cette clé et cette fenêtre. */
export async function isAuthRateLimited(
  c: PoolClient,
  kind: string,
  key: string,
  window: string,
  max: number,
): Promise<boolean> {
  return (await countAuthAttempts(c, kind, key, window)) >= max;
}

/** 1 chance sur 50 : retire les tentatives de plus de 24 h. */
export async function maybePurgeAuthAttempts(c: PoolClient, random: number = Math.random()): Promise<void> {
  if (random < 1 / 50) {
    await c.query("delete from auth_attempts where created_at < now() - interval '24 hours'");
  }
}
