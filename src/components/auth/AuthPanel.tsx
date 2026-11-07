"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { OtpForm } from "@/components/auth/OtpForm";
import type { OtpChallenge, OtpFlow, OtpResendData, OtpVerifyData } from "@/lib/auth-types";
import type { ActionState } from "@/lib/types";

type CredentialsAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;
type VerifyAction = (
  otpToken: string,
  code: string,
  flow: OtpFlow,
) => Promise<ActionState<OtpVerifyData>>;
type ResendAction = (otpToken: string) => Promise<ActionState<OtpResendData>>;

function challengeFrom(state: ActionState): OtpChallenge | null {
  const data = state?.data as Partial<OtpChallenge> | undefined;
  if (
    data?.needsOtp === true &&
    typeof data.otpToken === "string" &&
    typeof data.emailMasked === "string" &&
    (data.purpose === "register" || data.purpose === "login")
  ) {
    return {
      needsOtp: true,
      otpToken: data.otpToken,
      emailMasked: data.emailMasked,
      purpose: data.purpose,
      retryAfter: typeof data.retryAfter === "number" ? data.retryAfter : 30,
      devOtp: typeof data.devOtp === "string" ? data.devOtp : undefined,
    };
  }
  return null;
}

/** Session créée sans OTP (pause de la vérification) : redirection interne. */
function redirectFrom(state: ActionState): string | null {
  const data = state?.data as { redirectTo?: unknown } | undefined;
  return state?.ok && typeof data?.redirectTo === "string" ? data.redirectTo : null;
}

export function AuthPanel({
  signIn,
  signUp,
  resendOtp,
  verifyOtp,
  signedIn = false,
  otpEnabled = true,
}: {
  signIn: CredentialsAction;
  signUp: CredentialsAction;
  resendOtp: ResendAction;
  verifyOtp: VerifyAction;
  signedIn?: boolean;
  /** Faux quand `AUTH_OTP_ENABLED=0` : pas d'écran de code. */
  otpEnabled?: boolean;
}) {
  const router = useRouter();
  // Redirection uniquement si l'utilisateur était déjà connecté en arrivant :
  // après une validation OTP, le rafraîchissement serveur met `signedIn` à true
  // mais le composant n'est pas remonté. Il faut laisser l'animation se jouer.
  const wasSignedIn = useRef(signedIn);
  useEffect(() => {
    if (wasSignedIn.current) router.replace("/garage");
  }, [router]);

  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [flow, setFlow] = useState<OtpFlow>("login");

  if (challenge) {
    return (
      <OtpForm
        otpToken={challenge.otpToken}
        emailMasked={challenge.emailMasked}
        purpose={challenge.purpose}
        flow={flow}
        devOtp={challenge.devOtp}
        retryAfter={challenge.retryAfter}
        verifyAction={verifyOtp}
        resendAction={resendOtp}
        onBack={() => setChallenge(null)}
      />
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <section className="rounded-lg border border-line bg-panel p-5">
        <h2 className="mb-3 font-display text-xl font-bold uppercase tracking-wide">Connexion</h2>
        <ActionForm
          action={signIn}
          submitLabel="Se connecter"
          className="flex flex-col gap-3"
          onResult={(result) => {
            const target = redirectFrom(result);
            if (target) {
              router.replace(target);
              router.refresh();
              return;
            }
            const next = challengeFrom(result);
            if (next) {
              setFlow("login");
              setChallenge(next);
            }
          }}
        >
          <input name="email" type="email" placeholder="Email" required autoComplete="email" />
          <input
            name="password"
            type="password"
            placeholder="Mot de passe"
            required
            autoComplete="current-password"
          />
        </ActionForm>
        <p className="mt-3 text-xs text-zinc-500">
          {otpEnabled
            ? "Un code à 6 chiffres vous sera envoyé pour confirmer la connexion."
            : "Vérification par code temporairement en pause : connexion directe après le mot de passe."}
        </p>
      </section>

      <section className="rounded-lg border border-line bg-panel p-5">
        <h2 className="mb-1 font-display text-xl font-bold uppercase tracking-wide">Créer un compte</h2>
        <p className="mb-3 text-sm text-zinc-400">
          Le garage démarre vide. Vous tirez ensuite un moteur commun, une boîte commune, 5 cartes
          bonus, et vous recevez un jeu de chaque pneu.
          {otpEnabled
            ? " Un code à 6 chiffres vérifie votre e-mail."
            : " La vérification par e-mail est temporairement en pause."}
        </p>
        <ActionForm
          action={signUp}
          submitLabel="S'inscrire"
          variant="ghost"
          className="flex flex-col gap-3"
          onResult={(result) => {
            const target = redirectFrom(result);
            if (target) {
              router.replace(target);
              router.refresh();
              return;
            }
            const next = challengeFrom(result);
            if (next) {
              setFlow("register");
              setChallenge(next);
            }
          }}
        >
          <input
            name="username"
            type="text"
            placeholder="Pseudo"
            required
            minLength={3}
            maxLength={24}
            autoComplete="username"
          />
          <input name="email" type="email" placeholder="Email" required autoComplete="email" />
          <input
            name="password"
            type="password"
            placeholder="Mot de passe (8+ caractères)"
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
          />
        </ActionForm>
      </section>
    </div>
  );
}
