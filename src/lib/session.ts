import "server-only";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { withAdmin } from "@/lib/db";
import { invalidateOtherSessionsForHash } from "@/lib/session-tokens";
import type { Profile } from "@/lib/types";

/** Session + profil : une seule lecture (le Nav et les pages partagent ce cache de requête). */
export type CurrentUser = Profile & { email: string; xp_week: number; xp_month: number };

export const SESSION_COOKIE = "gb_session";
const SESSION_DAYS = 30;

// ---------- Mots de passe (scrypt, sel aléatoire) ----------------------------
const scryptAsync = (pw: string, salt: Buffer) =>
  new Promise<Buffer>((resolve, reject) => scrypt(pw, salt, 64, (e, k) => (e ? reject(e) : resolve(k))));

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${(await scryptAsync(password, salt)).toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scryptAsync(password, Buffer.from(saltHex, "hex"));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// ---------- Sessions (jeton opaque en cookie, hash SHA-256 en base) ----------
const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  await withAdmin(async (c) => {
    // Purge opportuniste : une session créée sur vingt nettoie les jetons expirés.
    if (Math.random() < 1 / 20) await c.query("delete from sessions where expires_at < now()");
    await c.query("insert into sessions (token_hash, user_id, expires_at) values ($1, $2, $3)", [hashToken(token), userId, expires]);
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await withAdmin((c) => c.query("delete from sessions where token_hash = $1", [hashToken(token)]));
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
  return token ? hashToken(token) : undefined;
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
      [hashToken(token)],
    ),
  );
  return rows[0] ?? null;
});
