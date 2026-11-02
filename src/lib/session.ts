import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { withAdmin } from "@/lib/db";
import {
  SESSION_COOKIE,
  deleteSessionByHash,
  generateSessionToken,
  hashSessionToken,
  invalidateOtherSessionsForHash,
  purgeExpiredSessions,
  rotateSessionForHash,
  sessionExpiresAt,
} from "@/lib/session-tokens";
import type { Profile } from "@/lib/types";

// Ré-export pratique pour les actions historiques (AccountForms).
export { hashPassword, verifyPassword } from "@/lib/password";
export { SESSION_COOKIE };

/** Session + profil : une seule lecture (le Nav et les pages partagent ce cache de requête). */
export type CurrentUser = Profile & { email: string; xp_week: number; xp_month: number };

/**
 * Crée une session opaque et pose le cookie.
 * Une éventuelle session courante (même cookie) est supprimée avant l'insertion :
 * la rotation évite l'accumulation de jetons après plusieurs connexions.
 */
export async function createSession(userId: string) {
  const store = await cookies();
  const previousToken = store.get(SESSION_COOKIE)?.value;
  const token = generateSessionToken();
  const expires = sessionExpiresAt();

  await withAdmin((c) =>
    rotateSessionForHash(
      c,
      userId,
      hashSessionToken(token),
      expires,
      previousToken ? hashSessionToken(previousToken) : undefined,
    ),
  );

  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });

  // Purge opportuniste, volontairement non bloquante pour la requête.
  if (Math.random() < 1 / 20) {
    void withAdmin((c) => purgeExpiredSessions(c)).catch(() => {});
  }
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await withAdmin((c) => deleteSessionByHash(c, hashSessionToken(token)));
  store.delete(SESSION_COOKIE);
}

/**
 * Révoque toutes les sessions de l'utilisateur sauf la session courante.
 * Utilisé après un changement de mot de passe : un jeton volé devient inutile
 * sans déconnecter le joueur qui vient d'effectuer la modification.
 * `currentTokenHash` est injectable pour les tests ; sinon le cookie courant est lu.
 */
export async function invalidateOtherSessions(userId: string, currentTokenHash?: string) {
  const keepHash = currentTokenHash ?? (await currentSessionHash());
  if (!keepHash) return;
  await withAdmin((c) => invalidateOtherSessionsForHash(c, userId, keepHash));
}

async function currentSessionHash(): Promise<string | undefined> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? hashSessionToken(token) : undefined;
}

/** Utilisateur de la requête courante, profil inclus (mis en cache pour la durée du rendu). */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const { rows } = await withAdmin((c) =>
    c.query<CurrentUser>(
      `select u.id, u.email, p.username, p.coins, p.xp_total, p.last_daily_pull, p.last_weekly_pull,
              coalesce(x.xp_week, 0)::integer as xp_week,
              coalesce(x.xp_month, 0)::integer as xp_month
         from sessions s
         join users u on u.id = s.user_id
         join profiles p on p.id = u.id
         left join lateral (
           select
             sum(e.amount) filter (where e.created_at >= b.week_start and e.created_at < b.week_end) as xp_week,
             sum(e.amount) filter (where e.created_at >= b.month_start and e.created_at < b.month_end) as xp_month
           from (
             select
               date_trunc('week', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris' as week_start,
               (date_trunc('week', now() at time zone 'Europe/Paris') + interval '1 week') at time zone 'Europe/Paris' as week_end,
               date_trunc('month', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris' as month_start,
               (date_trunc('month', now() at time zone 'Europe/Paris') + interval '1 month') at time zone 'Europe/Paris' as month_end
           ) b
           left join public.xp_events e
             on e.user_id = p.id
            and e.created_at >= least(b.week_start, b.month_start)
            and e.created_at < greatest(b.week_end, b.month_end)
         ) x on true
        where s.token_hash = $1 and s.expires_at > now()`,
      [hashSessionToken(token)],
    ),
  );
  return rows[0] ?? null;
});
