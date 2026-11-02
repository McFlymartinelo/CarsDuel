/**
 * Validation des identifiants et secrets de connexion.
 * Fonctions pures : utilisées par les Server Actions et par les tests node:test
 * sans dépendre de `next/headers`.
 */

export const USERNAME_RE = /^[A-Za-z0-9_.-]{3,24}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const EMAIL_MAX_LENGTH = 254;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/** E-mail tel que stocké/recherché : espaces retirés, minuscules. */
export function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

/** Message d'erreur français, ou `null` si le pseudo est valide. */
export function validateUsername(value: unknown): string | null {
  const username = String(value ?? "").trim();
  if (!USERNAME_RE.test(username)) {
    return "Pseudo : 3 à 24 caractères (lettres, chiffres, _ . -).";
  }
  return null;
}

/** Message d'erreur français, ou `null` si l'e-mail est valide. */
export function validateEmail(value: unknown): string | null {
  const email = normalizeEmail(value);
  if (email.length === 0 || email.length > EMAIL_MAX_LENGTH || !EMAIL_RE.test(email)) {
    return "Email invalide.";
  }
  return null;
}

/** Message d'erreur français, ou `null` si le mot de passe est valide. */
export function validatePassword(value: unknown): string | null {
  const password = String(value ?? "");
  if (password.length < PASSWORD_MIN_LENGTH) return "Mot de passe : 8 caractères minimum.";
  if (password.length > PASSWORD_MAX_LENGTH) return "Mot de passe : 128 caractères maximum.";
  return null;
}
