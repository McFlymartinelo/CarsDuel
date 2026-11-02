import { randomBytes, scrypt, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Hachage des mots de passe (scrypt, sel aléatoire, comparaison timing-safe).
 * Module volontairement sans `next/headers` : testable avec node:test.
 */

const scryptAsync = (pw: string, salt: Buffer) =>
  new Promise<Buffer>((resolve, reject) => scrypt(pw, salt, 64, (e, k) => (e ? reject(e) : resolve(k))));

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${(await scryptAsync(password, salt)).toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = String(stored ?? "").split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scryptAsync(password, Buffer.from(saltHex, "hex"));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// Sel fixe : le hash factice n'est jamais utilisé pour authentifier qui que ce
// soit, il sert uniquement à payer le même coût scrypt quand l'e-mail est inconnu.
const FAKE_SALT = Buffer.from("carsduel-fake-sa", "utf8");
let fakeHash: string | undefined;

/**
 * Vrai hash scrypt d'un mot de passe aléatoire, calculé une seule fois.
 * Comparer le mot de passe fourni à ce hash garantit un coût constant entre un
 * e-mail connu et un e-mail inconnu (pas de `"00:00"` ni de chaîne vide).
 */
export function fakePasswordHash(): string {
  fakeHash ??= `${FAKE_SALT.toString("hex")}:${scryptSync("carsduel-invalid-password", FAKE_SALT, 64).toString("hex")}`;
  return fakeHash;
}
