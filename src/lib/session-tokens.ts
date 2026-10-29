import type { PoolClient } from "pg";

/**
 * Supprime les sessions d'un utilisateur sauf celle du jeton courant.
 * Le jeton courant est identifié par son hash SHA-256 (jamais le jeton brut).
 * Fonction injectable (hash fourni) pour être testable hors du contexte Next.
 */
export function invalidateOtherSessionsForHash(c: PoolClient, userId: string, keepTokenHash: string) {
  return c.query("delete from sessions where user_id = $1 and token_hash <> $2", [userId, keepTokenHash]);
}
