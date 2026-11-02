import { createTransport, type TransportOptions } from "nodemailer";
import { OTP_TTL_MS } from "@/lib/otp";
import type { OtpPurpose } from "@/lib/otp-token";

/**
 * Envoi des codes OTP par SMTP.
 * - SMTP configuré : envoi réel, le code n'est jamais journalisé.
 * - SMTP absent en développement : le code est écrit dans la console (repli local).
 * - SMTP absent/échec en production : erreur claire, jamais de code loggé.
 */

export const DEFAULT_MAIL_FROM = "CarsDuel <noreply@carsduel.app>";

export type MailEnv = Record<string, string | undefined>;

export class MailerError extends Error {
  readonly userMessage: string;

  constructor(userMessage: string, cause?: unknown) {
    super(userMessage);
    this.name = "MailerError";
    this.userMessage = userMessage;
    if (cause instanceof Error) this.cause = cause;
  }
}

export function mailerConfigured(env: MailEnv = process.env): boolean {
  return Boolean(env.SMTP_URL?.trim() || env.SMTP_HOST?.trim());
}

function mailFrom(env: MailEnv): string {
  return env.SMTP_FROM?.trim() || env.MAIL_FROM?.trim() || DEFAULT_MAIL_FROM;
}

function positiveInt(value: string | undefined, fallback: number): number {
  const n = Number(String(value ?? "").trim());
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/** Diagnostic sûr : aucun mot de passe, aucun secret. */
export function describeSmtpConfig(env: MailEnv = process.env) {
  const port = positiveInt(env.SMTP_PORT, 587);
  return {
    configured: mailerConfigured(env),
    transport: env.SMTP_URL?.trim() ? ("url" as const) : env.SMTP_HOST?.trim() ? ("host" as const) : ("none" as const),
    host: env.SMTP_HOST?.trim() || undefined,
    port,
    secure: env.SMTP_SECURE === "1" || env.SMTP_SECURE === "true" || port === 465,
    from: mailFrom(env),
    user: env.SMTP_USER?.trim() || undefined,
  };
}

function transportOptions(env: MailEnv): string | TransportOptions {
  const url = env.SMTP_URL?.trim();
  if (url) return url;
  const port = positiveInt(env.SMTP_PORT, 587);
  const user = env.SMTP_USER?.trim();
  const pass = env.SMTP_PASS;
  return {
    host: env.SMTP_HOST?.trim(),
    port,
    secure: env.SMTP_SECURE === "1" || env.SMTP_SECURE === "true" || port === 465,
    ...(user && pass ? { auth: { user, pass } } : {}),
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  };
}

function purposeLabel(purpose: OtpPurpose): string {
  return purpose === "register" ? "Vérification de votre adresse e-mail" : "Connexion à votre compte";
}

function otpTtlMinutes(): number {
  return Math.max(1, Math.round(OTP_TTL_MS / 60_000));
}

/** Version texte de secours (pas d'image, pas de HTML requis). */
export function otpTextBody(code: string, purpose: OtpPurpose): string {
  return [
    "CarsDuel",
    "",
    `${purposeLabel(purpose)}`,
    "",
    `Votre code : ${code}`,
    "",
    `Ce code expire dans ${otpTtlMinutes()} minutes.`,
    "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.",
    "",
    "— L'équipe CarsDuel",
  ].join("\n");
}

/** E-mail HTML aux couleurs CarsDuel : fond sombre, accent ambre, aucune image externe. */
export function otpHtmlBody(code: string, purpose: OtpPurpose): string {
  const minutes = otpTtlMinutes();
  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:0;background-color:#0b0d12;color:#fafafa;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0b0d12;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#10131a;border:1px solid #27272a;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:24px 24px 8px 24px;text-align:center;">
                <div style="font-size:22px;font-weight:700;letter-spacing:2px;color:#fbbf24;text-transform:uppercase;">CarsDuel</div>
                <div style="height:2px;width:64px;margin:12px auto 0 auto;background-color:#f59e0b;border-radius:2px;"></div>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px 0 24px;text-align:center;color:#a1a1aa;font-size:14px;">
                ${purposeLabel(purpose)}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 24px;text-align:center;">
                <div style="display:inline-block;padding:14px 22px;background-color:#0b0d12;border:1px solid #f59e0b;border-radius:10px;color:#fbbf24;font-size:34px;font-weight:700;letter-spacing:10px;font-family:'Courier New',monospace;">${code}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 24px 8px 24px;text-align:center;color:#fafafa;font-size:14px;">
                Ce code expire dans ${minutes} minutes.
              </td>
            </tr>
            <tr>
              <td style="padding:0 24px 24px 24px;text-align:center;color:#a1a1aa;font-size:12px;line-height:1.5;">
                Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.<br />
                Ne communiquez jamais ce code à personne.
              </td>
            </tr>
            <tr>
              <td style="padding:14px 24px;border-top:1px solid #27272a;text-align:center;color:#a1a1aa;font-size:11px;">
                CarsDuel — duels automobiles asynchrones
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Envoie le code OTP. Le code n'apparaît dans aucun log quand SMTP est
 * configuré, et jamais en production.
 */
export async function sendOtpEmail(email: string, code: string, purpose: OtpPurpose): Promise<void> {
  const env = process.env;
  const isProduction = env.NODE_ENV === "production";

  if (!mailerConfigured(env)) {
    if (isProduction) {
      throw new MailerError(
        "Le service d'e-mail n'est pas configuré. Contactez l'administrateur, puis réessayez.",
      );
    }
    // Repli local explicitement autorisé : aucun SMTP en développement.
    console.info(`[mailer] SMTP non configuré — code OTP ${purpose} pour ${email} : ${code}`);
    return;
  }

  const transport = createTransport(transportOptions(env));
  try {
    await transport.sendMail({
      from: mailFrom(env),
      to: email,
      subject: purpose === "register" ? "CarsDuel — vérifiez votre e-mail" : "CarsDuel — votre code de connexion",
      text: otpTextBody(code, purpose),
      html: otpHtmlBody(code, purpose),
    });
  } catch (error) {
    // Jamais le contenu du mail (donc jamais le code) dans les logs.
    const errorCode = (error as { code?: unknown }).code;
    console.error("[mailer] échec d'envoi du code OTP", typeof errorCode === "string" ? errorCode : "");
    throw new MailerError("Impossible d'envoyer le code de vérification. Réessayez dans un instant.", error);
  }
}
