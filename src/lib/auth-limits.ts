/**
 * Plafonds d'authentification centralisés.
 * Surchargeables par variables d'environnement (principalement pour les tests),
 * avec les valeurs de production par défaut.
 */

export interface AuthLimits {
  /** Tentatives de connexion (IP) sur 15 min. */
  loginIp: number;
  /** Échecs de connexion (e-mail) sur 15 min. */
  loginFailEmail: number;
  /** Inscriptions (IP) sur 1 h. */
  signupIp: number;
  /** Envois OTP (IP) sur 15 min, toutes émissions confondues. */
  otpSendIp: number;
  /** Vérifications OTP (IP) sur 15 min. */
  otpVerifyIp: number;
  /** Fenêtre glissante des tentatives de connexion. */
  loginWindow: string;
  /** Fenêtre glissante des inscriptions. */
  signupWindow: string;
  /** Fenêtre glissante des OTP. */
  otpWindow: string;
  /** Cooldown entre deux envois OTP pour un même (user, purpose). */
  otpResendMs: number;
  /** Durée de vie d'un code OTP. */
  otpTtlMs: number;
}

function positiveInt(value: string | undefined, fallback: number): number {
  const n = Number(String(value ?? "").trim());
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export type AuthLimitEnv = Record<string, string | undefined>;

export function authLimits(env: AuthLimitEnv = process.env): AuthLimits {
  return {
    loginIp: positiveInt(env.AUTH_RATE_LIMIT_MAX, 20),
    loginFailEmail: positiveInt(env.AUTH_LOGIN_FAIL_MAX, 5),
    signupIp: positiveInt(env.AUTH_SIGNUP_RATE_LIMIT_MAX, 5),
    otpSendIp: positiveInt(env.AUTH_OTP_RATE_LIMIT_MAX, 8),
    otpVerifyIp: positiveInt(env.AUTH_OTP_VERIFY_RATE_LIMIT_MAX, 20),
    loginWindow: "15 minutes",
    signupWindow: "1 hour",
    otpWindow: "15 minutes",
    otpResendMs: positiveInt(env.AUTH_OTP_RESEND_MS, 30_000),
    otpTtlMs: positiveInt(env.AUTH_OTP_TTL_MS, 10 * 60_000),
  };
}
