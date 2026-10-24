import "server-only";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { withAdmin } from "@/lib/db";

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
  await withAdmin((c) =>
    c.query("insert into sessions (token_hash, user_id, expires_at) values ($1, $2, $3)", [hashToken(token), userId, expires]),
  );
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

/** Utilisateur de la requête courante (mis en cache pour la durée du rendu). */
export const getCurrentUser = cache(async (): Promise<{ id: string; email: string } | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const { rows } = await withAdmin((c) =>
    c.query(
      `select u.id, u.email from sessions s join users u on u.id = s.user_id
        where s.token_hash = $1 and s.expires_at > now()`,
      [hashToken(token)],
    ),
  );
  return rows[0] ?? null;
});
