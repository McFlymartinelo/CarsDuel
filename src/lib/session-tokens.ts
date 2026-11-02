import { createHash, randomBytes } from "node:crypto";
import type { PoolClient } from "pg";

/**
 * Sessions applicatives : jeton opaque aléatoire en cookie, hash SHA-256 en
 * base. Les helpers prenant un `PoolClient` restent testables hors Next.
 */

export const SESSION_COOKIE = "gb_session";
export const SESSION_DAYS = 30;

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionExpiresAt(now: Date = new Date()): Date {
  return new Date(now.getTime() + SESSION_DAYS * 864e5);
}

/**
 * Rotation : supprime l'éventuelle session liée au cookie courant, puis insère
 * la nouvelle. Le hash du jeton brut n'est jamais stocké.
 */
export async function rotateSessionForHash(
  c: PoolClient,
  userId: string,
  nextTokenHash: string,
  expiresAt: Date,
  previousTokenHash?: string,
): Promise<void> {
  if (previousTokenHash) {
    await c.query("delete from sessions where token_hash = $1", [previousTokenHash]);
  }
  await c.query("insert into sessions (token_hash, user_id, expires_at) values ($1, $2, $3)", [
    nextTokenHash,
    userId,
    expiresAt,
  ]);
}

/** Renvoie l'utilisateur d'une session encore valide, sinon `null`. */
export async function findActiveSession(
  c: PoolClient,
  tokenHash: string,
  now: Date = new Date(),
): Promise<string | null> {
  const { rows } = await c.query<{ user_id: string }>(
    "select user_id from sessions where token_hash = $1 and expires_at > $2",
    [tokenHash, now],
  );
  return rows[0]?.user_id ?? null;
}

export async function deleteSessionByHash(c: PoolClient, tokenHash: string): Promise<void> {
  await c.query("delete from sessions where token_hash = $1", [tokenHash]);
}

export async function purgeExpiredSessions(c: PoolClient, now: Date = new Date()): Promise<void> {
  await c.query("delete from sessions where expires_at <= $1", [now]);
}

/**
 * Supprime les sessions d'un utilisateur sauf celle du jeton courant.
 * Le jeton courant est identifié par son hash SHA-256 (jamais le jeton brut).
 * Fonction injectable (hash fourni) pour être testable hors du contexte Next.
 */
export function invalidateOtherSessionsForHash(c: PoolClient, userId: string, keepTokenHash: string) {
  return c.query("delete from sessions where user_id = $1 and token_hash <> $2", [userId, keepTokenHash]);
}
