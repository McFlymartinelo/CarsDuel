import jwt from "jsonwebtoken";

/**
 * JWT court (15 min) qui porte uniquement le défi OTP entre « mot de passe
 * validé » et « code validé ». Il ne donne aucun accès à l'application : la
 * session reste un jeton opaque relu en base.
 */

export type OtpPurpose = "register" | "login";

export const OTP_JWT_ISSUER = "carsduel";
export const OTP_JWT_AUDIENCE = "carsduel-otp";
export const OTP_JWT_TTL = "15m";
export const OTP_TOKEN_ERROR = "Code expiré — reconnectez-vous.";

const DEMO_SECRETS = new Set([
  "change-me",
  "changeme",
  "secret",
  "dev-secret",
  "carsduel",
  "carsduel-otp-secret",
  "carsduel-dev-otp-jwt-secret",
  "carsduel-dev-otp-jwt-secret-change-me-32",
]);

export const DEV_OTP_JWT_SECRET = "carsduel-dev-otp-jwt-secret-change-me-32";

export type OtpJwtEnv = {
  NODE_ENV?: string;
  AUTH_OTP_JWT_SECRET?: string;
};

/** Secret HS256 : obligatoire et robuste en production, repli dev documenté. */
export function resolveOtpJwtSecret(env: OtpJwtEnv = process.env): string {
  const value = env.AUTH_OTP_JWT_SECRET?.trim();
  if (env.NODE_ENV === "production") {
    if (!value || value.length < 32 || DEMO_SECRETS.has(value.toLowerCase())) {
      throw new Error("AUTH_OTP_JWT_SECRET manquant ou trop faible (32 caractères minimum, valeur non démo).");
    }
    return value;
  }
  return value && value.length > 0 ? value : DEV_OTP_JWT_SECRET;
}

export function signOtpToken(userId: string, purpose: OtpPurpose): string {
  return jwt.sign(
    { sub: userId, purpose: "otp", otpPurpose: purpose },
    resolveOtpJwtSecret(),
    {
      algorithm: "HS256",
      expiresIn: OTP_JWT_TTL,
      issuer: OTP_JWT_ISSUER,
      audience: OTP_JWT_AUDIENCE,
    },
  );
}

export type OtpTokenResult =
  | { ok: true; userId: string; otpPurpose: OtpPurpose }
  | { ok: false; message: string };

/**
 * Vérifie signature, expiration, issuer, audience, `purpose` et `otpPurpose`.
 * Toute erreur renvoie le même message générique (jamais le token ni le détail).
 */
export function readOtpToken(token: string | null | undefined): OtpTokenResult {
  if (!token || typeof token !== "string") return { ok: false, message: OTP_TOKEN_ERROR };
  try {
    const payload = jwt.verify(token, resolveOtpJwtSecret(), {
      algorithms: ["HS256"],
      issuer: OTP_JWT_ISSUER,
      audience: OTP_JWT_AUDIENCE,
    });
    if (typeof payload === "string") return { ok: false, message: OTP_TOKEN_ERROR };

    const { sub, purpose, otpPurpose } = payload as jwt.JwtPayload & {
      purpose?: unknown;
      otpPurpose?: unknown;
    };
    if (typeof sub !== "string" || sub.length === 0) return { ok: false, message: OTP_TOKEN_ERROR };
    if (purpose !== "otp") return { ok: false, message: OTP_TOKEN_ERROR };
    if (otpPurpose !== "register" && otpPurpose !== "login") {
      return { ok: false, message: OTP_TOKEN_ERROR };
    }
    return { ok: true, userId: sub, otpPurpose };
  } catch {
    return { ok: false, message: OTP_TOKEN_ERROR };
  }
}
