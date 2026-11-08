"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { PoolClient } from "pg";
import { withAdmin } from "@/lib/db";
import { resolveClientIp } from "@/lib/client-ip";
import { createSession, destroySession } from "@/lib/session";
import { fakePasswordHash, hashPassword, verifyPassword } from "@/lib/password";
import { authLimits } from "@/lib/auth-limits";
import {
  clearAuthAttempts,
  countAuthAttempts,
  maybePurgeAuthAttempts,
  recordAuthAttempt,
} from "@/lib/auth-attempts";
import {
  checkOtp,
  generateOtpCode,
  hashOtpCode,
  isOtpCodeFormat,
  maskEmail,
  otpEchoEnabled,
  otpEnabled,
  resolveOtpPepper,
  resendCooldownRemaining,
} from "@/lib/otp";
import { deleteOtp, getOtp, issueOtp, purgeExpiredOtps, setOtpAttempts } from "@/lib/otp-store";
import { OTP_TOKEN_ERROR, readOtpToken, signOtpToken } from "@/lib/otp-token";
import { MailerError, sendOtpEmail } from "@/lib/mailer";
import { normalizeEmail, validateEmail, validatePassword, validateUsername } from "@/lib/validation";
import type { ActionState } from "@/lib/types";
import type { OtpChallenge, OtpFlow, OtpPurpose, OtpResendData, OtpVerifyData, CredentialsData } from "@/lib/auth-types";

const BLOCKED = "Trop de tentatives, réessayez plus tard.";
const SIGNUP_GENERIC = "Impossible de créer le compte avec ces informations.";
const BAD_CREDENTIALS = "Email ou mot de passe incorrect.";
const UNVERIFIED_EMAIL = "Votre adresse e-mail n'est pas encore vérifiée. Reprenez l'inscription pour recevoir un nouveau code.";
const INVALID_OTP = "Code incorrect ou expiré. Demandez un nouveau code.";

/** IP client fiable selon TRUSTED_PROXY_COUNT (cf. src/lib/client-ip.ts), sinon "unknown". */
async function clientIp(): Promise<string> {
  const fwd = (await headers()).get("x-forwarded-for");
  return resolveClientIp(fwd, process.env.TRUSTED_PROXY_COUNT);
}

function mailErrorMessage(error: unknown): string {
  if (error instanceof MailerError) return error.userMessage;
  return "Impossible d'envoyer le code de vérification. Réessayez dans un instant.";
}

function optionalDevOtp(code: string): string | undefined {
  return otpEchoEnabled() ? code : undefined;
}

function retryAfterSeconds(ms: number): number {
  return Math.max(1, Math.ceil(ms / 1000));
}

/**
 * Marque l'e-mail vérifié et attribue le kit de départ, une seule fois.
 * Idempotent : `returning id` garantit une seule attribution même en cas de
 * double soumission concurrente.
 */
async function markVerified(c: PoolClient, userId: string): Promise<void> {
  const { rowCount } = await c.query(
    "update users set email_verified = true where id = $1 and email_verified = false returning id",
    [userId],
  );
  if ((rowCount ?? 0) > 0) {
    await c.query("select private.grant_starter_kit($1)", [userId]);
  }
}

async function activateAccount(userId: string): Promise<void> {
  await withAdmin((c) => markVerified(c, userId));
}

/**
 * Émet un OTP et l'envoie. Compte systématiquement un envoi `otp_send_ip`.
 * Aucune session n'est créée à ce stade.
 */
async function issueChallenge(
  userId: string,
  email: string,
  purpose: OtpPurpose,
  ip: string,
): Promise<ActionState<OtpChallenge>> {
  const limits = authLimits();

  const limited = await withAdmin(async (c) => {
    await maybePurgeAuthAttempts(c);
    if (await countAuthAttempts(c, "otp_send_ip", ip, limits.otpWindow) >= limits.otpSendIp) {
      return true;
    }
    await recordAuthAttempt(c, "otp_send_ip", ip);
    return false;
  });
  if (limited) return { ok: false, message: BLOCKED };

  const code = generateOtpCode();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + limits.otpTtlMs);

  let otpToken: string;
  let pepper: string;
  try {
    // Valider les secrets avant tout envoi : une configuration incomplète ne
    // doit ni créer de session ni expédier un code inutilisable.
    otpToken = signOtpToken(userId, purpose);
    pepper = resolveOtpPepper();
  } catch (error) {
    console.error("[auth] configuration OTP invalide", error instanceof Error ? error.message : "");
    return { ok: false, message: "La vérification est indisponible. Réessayez plus tard." };
  }

  try {
    await withAdmin((c) =>
      issueOtp(c, {
        userId,
        email,
        purpose,
        codeHash: hashOtpCode(code, pepper),
        expiresAt,
        createdAt: now,
      }),
    );
  } catch (error) {
    console.error("[auth] émission OTP impossible", error instanceof Error ? error.message : "");
    return { ok: false, message: "La vérification est indisponible. Réessayez plus tard." };
  }

  if (Math.random() < 1 / 50) {
    void withAdmin((c) => purgeExpiredOtps(c)).catch(() => {});
  }

  try {
    await sendOtpEmail(email, code, purpose);
  } catch (error) {
    // Le compte reste non vérifié : la connexion ou le renvoi permettent de reprendre.
    return { ok: false, message: mailErrorMessage(error) };
  }

  return {
    ok: true,
    data: {
      needsOtp: true,
      otpToken,
      emailMasked: maskEmail(email),
      purpose,
      retryAfter: retryAfterSeconds(limits.otpResendMs),
      devOtp: optionalDevOtp(code),
    },
  };
}

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState<CredentialsData>> {
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  const ip = await clientIp();
  const limits = authLimits();

  const allowed = await withAdmin(async (c) => {
    await maybePurgeAuthAttempts(c);
    if (await countAuthAttempts(c, "login_ip", ip, limits.loginWindow) >= limits.loginIp) return false;
    await recordAuthAttempt(c, "login_ip", ip);
    const emailFails = await countAuthAttempts(c, "login_fail_email", email, limits.loginWindow);
    return emailFails < limits.loginFailEmail;
  });
  if (!allowed) return { ok: false, message: BLOCKED };

  const { rows } = await withAdmin((c) =>
    c.query<{ id: string; email: string; password_hash: string; email_verified: boolean }>(
      `select id, email, password_hash, email_verified
         from users where lower(email) = lower($1) limit 1`,
      [email],
    ),
  );
  const user = rows[0];

  // Même message et même coût scrypt que l'e-mail existe ou non.
  const ok = await verifyPassword(password, user?.password_hash ?? fakePasswordHash());
  if (!user || !ok) {
    await withAdmin((c) => recordAuthAttempt(c, "login_fail_email", email));
    return { ok: false, message: BAD_CREDENTIALS };
  }

  await withAdmin((c) => clearAuthAttempts(c, "login_fail_email", email));

  // L'OTP sert uniquement à confirmer l'adresse lors de l'inscription.
  // Les anciens comptes non vérifiés peuvent reprendre le parcours d'inscription
  // pour recevoir un nouveau code, mais une connexion ne déclenche jamais d'OTP.
  if (!user.email_verified) {
    if (otpEnabled()) return { ok: false, message: UNVERIFIED_EMAIL };
    // Pause d'inscription : rendre le compte actif comme avant.
    await activateAccount(user.id);
  }

  await createSession(user.id);
  return { ok: true, data: { redirectTo: "/garage" } };
}

export async function signUp(_prev: ActionState, formData: FormData): Promise<ActionState<CredentialsData>> {
  const username = String(formData.get("username") ?? "").trim();
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  const ip = await clientIp();
  const limits = authLimits();
  const otpOn = otpEnabled();

  const emailError = validateEmail(email);
  if (emailError) return { ok: false, message: emailError };
  const passwordError = validatePassword(password);
  if (passwordError) return { ok: false, message: passwordError };

  const limited = await withAdmin(async (c) => {
    await maybePurgeAuthAttempts(c);
    if (await countAuthAttempts(c, "signup_ip", ip, limits.signupWindow) >= limits.signupIp) {
      return true;
    }
    await recordAuthAttempt(c, "signup_ip", ip);
    return false;
  });
  if (limited) return { ok: false, message: BLOCKED };

  const existing = (
    await withAdmin((c) =>
      c.query<{ id: string; email: string; password_hash: string; email_verified: boolean }>(
        `select id, email, password_hash, email_verified
           from users where lower(email) = lower($1) limit 1`,
        [email],
      ),
    )
  ).rows[0];

  if (existing) {
    const matches = await verifyPassword(password, existing.password_hash);
    if (!existing.email_verified && matches) {
      // Récupération d'une inscription interrompue avant validation de l'OTP :
      // le pseudo fourni n'a pas à correspondre au compte existant.
      if (!otpOn) {
        await activateAccount(existing.id);
        await createSession(existing.id);
        return { ok: true, data: { redirectTo: "/garage?bienvenue=1" } };
      }
      return issueChallenge(existing.id, existing.email, "register", ip);
    }
    return { ok: false, message: SIGNUP_GENERIC };
  }

  // Le pseudo n'est vérifié que pour une création réelle : une reprise de
  // compte non vérifié ne doit pas être bloquée par un pseudo déjà pris.
  const usernameError = validateUsername(username);
  if (usernameError) return { ok: false, message: usernameError };

  const hash = await hashPassword(password);
  let userId: string;
  try {
    userId = await withAdmin(async (c: PoolClient) => {
      const { rows } = await c.query<{ id: string }>(
        `insert into users (email, password_hash, email_verified)
         values ($1, $2, $3) returning id`,
        [email, hash, !otpOn],
      );
      await c.query("insert into profiles (id, username) values ($1, $2)", [rows[0].id, username]);
      // Sans OTP, le compte est actif tout de suite : le kit part dans la même
      // transaction. Avec OTP, pas de kit tant que l'e-mail n'est pas vérifié.
      if (!otpOn) {
        await c.query("select private.grant_starter_kit($1)", [rows[0].id]);
      }
      return rows[0].id;
    });
  } catch (e) {
    const err = e as { code?: string; constraint?: string; message?: string; stack?: string };
    if (err.code === "23505" && err.constraint?.includes("username")) {
      return { ok: false, message: "Ce pseudo est déjà pris." };
    }
    if (err.code === "23505" && err.constraint?.includes("email")) {
      // Course entre deux inscriptions : on tente de reprendre le compte non vérifié.
      const raced = (
        await withAdmin((c) =>
          c.query<{ id: string; email: string; password_hash: string; email_verified: boolean }>(
            `select id, email, password_hash, email_verified
               from users where lower(email) = lower($1) limit 1`,
            [email],
          ),
        )
      ).rows[0];
      if (raced && !raced.email_verified && (await verifyPassword(password, raced.password_hash))) {
        if (!otpOn) {
          await activateAccount(raced.id);
          await createSession(raced.id);
          return { ok: true, data: { redirectTo: "/garage?bienvenue=1" } };
        }
        return issueChallenge(raced.id, raced.email, "register", ip);
      }
      return { ok: false, message: SIGNUP_GENERIC };
    }
    if (err.code !== "23505") console.error("[signUp]", err.message ?? "", err.code ?? "", err.stack ?? "");
    return { ok: false, message: SIGNUP_GENERIC };
  }

  if (!otpOn) {
    // Compte déjà activé et kit versé dans la transaction d'inscription.
    await createSession(userId);
    return { ok: true, data: { redirectTo: "/garage?bienvenue=1" } };
  }

  return issueChallenge(userId, email, "register", ip);
}

/** Renvoi d'un code : cooldown de 30 s pour le même (userId, purpose). */
export async function resendOtp(otpToken: string): Promise<ActionState<OtpResendData>> {
  const parsed = readOtpToken(otpToken);
  if (!parsed.ok) return { ok: false, message: parsed.message };

  const ip = await clientIp();
  const limits = authLimits();

  const user = (
    await withAdmin((c) =>
      c.query<{ email: string }>("select email from users where id = $1", [parsed.userId]),
    )
  ).rows[0];
  if (!user) return { ok: false, message: OTP_TOKEN_ERROR };

  const existing = await withAdmin((c) => getOtp(c, parsed.userId, parsed.otpPurpose));
  if (existing) {
    const remaining = resendCooldownRemaining(existing.created_at, Date.now(), limits.otpResendMs);
    if (remaining > 0) {
      const retryAfter = retryAfterSeconds(remaining);
      return {
        ok: false,
        message: `Patientez encore ${retryAfter} s avant de demander un nouveau code.`,
        data: {
          retryAfter,
          otpToken,
          emailMasked: maskEmail(user.email),
          purpose: parsed.otpPurpose,
        },
      };
    }
  }

  const code = generateOtpCode();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + limits.otpTtlMs);

  let nextToken: string;
  let pepper: string;
  try {
    nextToken = signOtpToken(parsed.userId, parsed.otpPurpose);
    pepper = resolveOtpPepper();
  } catch (error) {
    console.error("[auth] configuration OTP invalide", error instanceof Error ? error.message : "");
    return { ok: false, message: "La vérification est indisponible. Réessayez plus tard." };
  }
  const codeHash = hashOtpCode(code, pepper);

  const limited = await withAdmin(async (c) => {
    await maybePurgeAuthAttempts(c);
    if (await countAuthAttempts(c, "otp_send_ip", ip, limits.otpWindow) >= limits.otpSendIp) {
      return true;
    }
    await recordAuthAttempt(c, "otp_send_ip", ip);
    await issueOtp(c, {
      userId: parsed.userId,
      email: user.email,
      purpose: parsed.otpPurpose,
      codeHash,
      expiresAt,
      createdAt: now,
    });
    return false;
  });
  if (limited) return { ok: false, message: BLOCKED };

  if (Math.random() < 1 / 50) {
    void withAdmin((c) => purgeExpiredOtps(c)).catch(() => {});
  }

  try {
    await sendOtpEmail(user.email, code, parsed.otpPurpose);
  } catch (error) {
    return { ok: false, message: mailErrorMessage(error) };
  }

  return {
    ok: true,
    data: {
      otpToken: nextToken,
      emailMasked: maskEmail(user.email),
      purpose: parsed.otpPurpose,
      retryAfter: retryAfterSeconds(limits.otpResendMs),
      devOtp: optionalDevOtp(code),
    },
  };
}

/**
 * Vérifie le code, marque le compte vérifié (une seule fois), attribue le kit
 * de départ (une seule fois) puis crée la session opaque.
 *
 * `flow` vient du parcours UI (inscription ou connexion) et ne sert qu'à choisir
 * une redirection interne fixe ; aucune URL client n'est acceptée.
 */
export async function verifyOtp(
  otpToken: string,
  code: string,
  flow: OtpFlow,
): Promise<ActionState<OtpVerifyData>> {
  if (flow !== "register" && flow !== "login") {
    return { ok: false, message: OTP_TOKEN_ERROR };
  }

  const parsed = readOtpToken(otpToken);
  if (!parsed.ok) return { ok: false, message: parsed.message };
  if (flow === "register" && parsed.otpPurpose !== "register") {
    return { ok: false, message: OTP_TOKEN_ERROR };
  }

  const ip = await clientIp();
  const limits = authLimits();
  const limited = await withAdmin(async (c) => {
    await maybePurgeAuthAttempts(c);
    if (await countAuthAttempts(c, "otp_verify_ip", ip, limits.otpWindow) >= limits.otpVerifyIp) {
      return true;
    }
    await recordAuthAttempt(c, "otp_verify_ip", ip);
    return false;
  });
  if (limited) return { ok: false, message: BLOCKED };

  const normalized = String(code ?? "").replace(/\D/g, "");
  if (!isOtpCodeFormat(normalized)) {
    return { ok: false, message: "Saisissez les 6 chiffres du code." };
  }

  let pepper: string;
  try {
    pepper = resolveOtpPepper();
  } catch (error) {
    console.error("[auth] pepper OTP indisponible", error instanceof Error ? error.message : "");
    return { ok: false, message: "La vérification est indisponible. Réessayez plus tard." };
  }

  const verified = await withAdmin(async (c) => {
    const record = await getOtp(c, parsed.userId, parsed.otpPurpose);
    const check = checkOtp(record, normalized, pepper);

    if (check.status !== "ok") {
      if (check.deleteCode) {
        await deleteOtp(c, parsed.userId, parsed.otpPurpose);
      } else if (check.status === "invalid") {
        await setOtpAttempts(c, parsed.userId, parsed.otpPurpose, check.attempts);
      }
      return false;
    }

    await deleteOtp(c, parsed.userId, parsed.otpPurpose);
    await markVerified(c, parsed.userId);
    return true;
  });

  if (!verified) return { ok: false, message: INVALID_OTP };

  await createSession(parsed.userId);

  // Redirection interne fixe, choisie côté serveur.
  const redirectTo = flow === "register" ? "/garage?bienvenue=1" : "/garage";
  return { ok: true, data: { redirectTo } };
}

export async function signOut() {
  await destroySession();
  redirect("/auth/login");
}
