/** Contrats partagés entre les Server Actions d'auth et les composants client. */

export type OtpPurpose = "register" | "login";
export type OtpFlow = "register" | "login";

export interface OtpChallenge {
  needsOtp: true;
  otpToken: string;
  emailMasked: string;
  purpose: OtpPurpose;
  /** Secondes avant de pouvoir demander un nouveau code. */
  retryAfter: number;
  /** Uniquement hors production (NODE_ENV=test ou AUTH_OTP_ECHO=1). */
  devOtp?: string;
}

export interface OtpResendData {
  otpToken: string;
  emailMasked: string;
  purpose: OtpPurpose;
  retryAfter: number;
  devOtp?: string;
}

export interface OtpVerifyData {
  redirectTo: string;
}

/** Connexion directe d'un compte vérifié, sans code OTP. */
export interface SignedInData {
  redirectTo: string;
}

/** Une inscription peut demander un OTP ; la connexion établie ouvre une session directe. */
export type CredentialsData = OtpChallenge | SignedInData;
