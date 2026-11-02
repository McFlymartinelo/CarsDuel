import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

/**
 * Cœur de la vérification e-mail par OTP.
 * Aucune dépendance à Next.js : fonctions pures et injectables (horloge, pepper),
 * testables directement avec node:test.
 */

export const OTP_CODE_LENGTH = 6;
export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_RESEND_MS = 30 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

/** Valeurs de démonstration explicitement refusées en production. */
const DEMO_PEPPERS = new Set([
  "change-me",
  "changeme",
  "secret",
  "pepper",
  "dev-pepper",
  "carsduel",
  "carsduel-otp-pepper",
  "carsduel-dev-otp-pepper",
  "carsduel-dev-otp-pepper-change-me-32-chars",
]);

export const DEV_OTP_PEPPER = "carsduel-dev-otp-pepper-change-me-32-chars";

/** Code à 6 chiffres, uniformément réparti (0 → 999999), zéro-padded. */
export function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(OTP_CODE_LENGTH, "0");
}

/** Vrai pour exactement 6 chiffres ASCII. */
export function isOtpCodeFormat(code: unknown): code is string {
  return typeof code === "string" && /^\d{6}$/.test(code);
}

/** HMAC-SHA256 du code avec le pepper, en hexadécimal. */
export function hashOtpCode(code: string, pepper: string): string {
  return createHmac("sha256", pepper).update(code, "utf8").digest("hex");
}

/** Comparaison timing-safe entre le code saisi et le hash stocké. */
export function otpMatches(code: string, storedHash: string, pepper: string): boolean {
  if (!storedHash) return false;
  const actual = Buffer.from(hashOtpCode(code, pepper), "hex");
  let expected: Buffer;
  try {
    expected = Buffer.from(storedHash, "hex");
  } catch {
    return false;
  }
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export interface StoredOtp {
  code_hash: string;
  expires_at: string | Date | number;
  attempts: number;
  created_at: string | Date | number;
}

export type OtpCheckStatus = "ok" | "missing" | "expired" | "invalid" | "too_many_attempts";

export interface OtpCheckResult {
  status: OtpCheckStatus;
  /** Nombre de tentatives à enregistrer ; 0 quand aucun code actif ne reste. */
  attempts: number;
  /** Vrai si la ligne doit être supprimée (succès, expiration, 5e échec). */
  deleteCode: boolean;
}

function toMs(value: string | Date | number): number {
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Évalue une tentative : expiration, plafond de 5 essais, comparaison du code.
 * Le code n'est jamais conservé en clair.
 */
export function checkOtp(
  record: StoredOtp | null | undefined,
  code: string,
  pepper: string,
  now: number = Date.now(),
): OtpCheckResult {
  if (!record) return { status: "missing", attempts: 0, deleteCode: false };

  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    return { status: "too_many_attempts", attempts: record.attempts, deleteCode: true };
  }
  if (toMs(record.expires_at) <= now) {
    return { status: "expired", attempts: record.attempts, deleteCode: true };
  }
  if (!otpMatches(code, record.code_hash, pepper)) {
    const attempts = record.attempts + 1;
    return {
      status: "invalid",
      attempts,
      deleteCode: attempts >= OTP_MAX_ATTEMPTS,
    };
  }
  return { status: "ok", attempts: record.attempts, deleteCode: true };
}

/**
 * Millisecondes restantes avant un nouvel envoi pour `(user_id, purpose)`.
 * 0 = envoi autorisé.
 */
export function resendCooldownRemaining(
  createdAt: string | Date | number,
  now: number = Date.now(),
  cooldownMs: number = OTP_RESEND_MS,
): number {
  const created = toMs(createdAt);
  if (!created) return 0;
  return Math.max(0, created + cooldownMs - now);
}

/** `alex@domaine.com` → `a***@domaine.com` (jamais l'adresse complète). */
export function maskEmail(email: string): string {
  const [local = "", domain = ""] = String(email ?? "").trim().split("@");
  if (!domain) return "***";
  const head = local.slice(0, 1) || "*";
  return `${head}***@${domain}`;
}

export type OtpEchoEnv = {
  NODE_ENV?: string;
  AUTH_OTP_ECHO?: string;
};

/** `devOtp` n'est jamais autorisé en production. */
export function otpEchoEnabled(env: OtpEchoEnv = process.env): boolean {
  return env.NODE_ENV !== "production" && (env.NODE_ENV === "test" || env.AUTH_OTP_ECHO === "1");
}

export type OtpFlagEnv = {
  /** Présent uniquement pour rendre `process.env` structurellement compatible. */
  NODE_ENV?: string;
  AUTH_OTP_ENABLED?: string;
};

/**
 * Interrupteur de pause : `AUTH_OTP_ENABLED=0` (ou false/off/no) désactive la
 * vérification par code et reconnecte directement après le mot de passe.
 * Actif par défaut, y compris en production, pour ne jamais l'oublier.
 */
export function otpEnabled(env: OtpFlagEnv = process.env): boolean {
  const value = env.AUTH_OTP_ENABLED?.trim().toLowerCase();
  return value !== "0" && value !== "false" && value !== "off" && value !== "no";
}

export type OtpSecretEnv = {
  NODE_ENV?: string;
  AUTH_OTP_PEPPER?: string;
};

/**
 * Pepper HMAC. Obligatoire (32+ caractères, valeur non démo) en production ;
 * repli de développement documenté sinon.
 */
export function resolveOtpPepper(env: OtpSecretEnv = process.env): string {
  const value = env.AUTH_OTP_PEPPER?.trim();
  if (env.NODE_ENV === "production") {
    if (!value || value.length < 32 || DEMO_PEPPERS.has(value.toLowerCase())) {
      throw new Error("AUTH_OTP_PEPPER manquant ou trop faible (32 caractères minimum, valeur non démo).");
    }
    return value;
  }
  return value && value.length > 0 ? value : DEV_OTP_PEPPER;
}
