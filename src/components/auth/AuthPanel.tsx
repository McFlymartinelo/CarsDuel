"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Circle, LoaderCircle } from "lucide-react";
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
  /** Contrôle uniquement la vérification par code à l'inscription. */
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
  const [loginSuccess, setLoginSuccess] = useState<string | null>(null);
  const [loginPending, setLoginPending] = useState(false);
  const [loginStep, setLoginStep] = useState(0);
  const loginStartedAt = useRef(0);
  const loginRedirect = useRef<string | null>(null);
  const loginStepTimer = useRef<number | null>(null);

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

  if (loginSuccess) {
    return (
      <section className="mx-auto w-full max-w-md rounded-2xl border border-line bg-panel p-6 text-center shadow-xl sm:p-8" aria-live="polite">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl border border-emerald-400/50 bg-emerald-400/10 text-emerald-300">
          <Check size={32} strokeWidth={3} aria-hidden="true" />
        </div>
        <h2 className="mt-5 font-display text-3xl font-bold uppercase text-white">Bon retour !</h2>
        <p className="mt-2 text-sm text-zinc-400">Tu es bien connecté.</p>
        <ol className="mx-auto mt-6 grid max-w-xs gap-3 text-left text-sm">
          {["Identifiants", "Contrôle de sécurité", "Authentification"].map((step) => (
            <li key={step} className="flex items-center gap-3 text-emerald-300">
              <span className="grid size-5 place-items-center rounded-full bg-emerald-400/15" aria-hidden="true">
                <Check size={13} strokeWidth={3} />
              </span>
              {step}
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={() => {
            router.replace(loginSuccess);
            router.refresh();
          }}
          className="mt-7 min-h-12 w-full rounded-lg bg-amber-500 px-4 font-semibold text-black hover:bg-amber-400"
        >
          Continuer <span aria-hidden="true">→</span>
        </button>
      </section>
    );
  }

  return (
    <div className="relative">
    <div className={`grid gap-6 sm:grid-cols-2 ${loginPending ? "invisible" : ""}`} aria-hidden={loginPending}>
      <section className="rounded-lg border border-line bg-panel p-5">
        <h2 className="mb-3 font-display text-xl font-bold uppercase tracking-wide">Connexion</h2>
        <ActionForm
          action={signIn}
          submitLabel="Se connecter"
          className="flex flex-col gap-3"
          onPendingChange={(pending) => {
            if (pending) {
              loginStartedAt.current = Date.now();
              loginRedirect.current = null;
              setLoginStep(0);
              setLoginPending(true);
              loginStepTimer.current = window.setInterval(() => {
                setLoginStep((step) => Math.min(2, step + 1));
              }, 650);
              return;
            }

            const target = loginRedirect.current;
            // Let the three visible stages play before showing the result, even
            // when the server responds almost immediately.
            const remaining = Math.max(0, 1950 - (Date.now() - loginStartedAt.current));
            window.setTimeout(() => {
              if (loginStepTimer.current !== null) {
                window.clearInterval(loginStepTimer.current);
                loginStepTimer.current = null;
              }
              setLoginPending(false);
              if (target) setLoginSuccess(target);
            }, remaining);
          }}
          onResult={(result) => {
            const target = redirectFrom(result);
            if (target) {
              loginRedirect.current = target;
              return;
            }
            const next = challengeFrom(result);
            if (next) {
              setFlow("login");
              setChallenge(next);
            }
          }}
        >
          <label htmlFor="signin-email" className="sr-only">Adresse e-mail</label>
          <input id="signin-email" name="email" type="email" placeholder="Email" required autoComplete="email" />
          <label htmlFor="signin-password" className="sr-only">Mot de passe</label>
          <input
            id="signin-password"
            name="password"
            type="password"
            placeholder="Mot de passe"
            required
            autoComplete="current-password"
          />
        </ActionForm>
        <p className="mt-3 text-xs text-zinc-500">
          Après confirmation de l’adresse e-mail à l’inscription, la connexion se fait directement avec votre mot de passe.
        </p>
      </section>

      <section className="rounded-lg border border-line bg-panel p-5">
        <h2 className="mb-1 font-display text-xl font-bold uppercase tracking-wide">Créer un compte</h2>
        <p className="mb-3 text-sm text-zinc-400">
          Le garage démarre vide. Vous tirez ensuite un moteur commun, une boîte commune, 5 cartes
          bonus, et vous recevez un jeu de chaque pneu.
          {otpEnabled
            ? " Un code à 6 chiffres vérifie votre adresse e-mail à l'inscription."
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
          <label htmlFor="signup-username" className="sr-only">Pseudo</label>
          <input
            id="signup-username"
            name="username"
            type="text"
            placeholder="Pseudo"
            required
            minLength={3}
            maxLength={24}
            autoComplete="username"
          />
          <label htmlFor="signup-email" className="sr-only">Adresse e-mail</label>
          <input id="signup-email" name="email" type="email" placeholder="Email" required autoComplete="email" />
          <label htmlFor="signup-password" className="sr-only">Mot de passe</label>
          <input
            id="signup-password"
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
    {loginPending && (
      <section className="absolute inset-0 z-10 grid place-items-center rounded-lg border border-line bg-panel/95 p-6 text-center shadow-xl backdrop-blur-sm" aria-live="polite" aria-busy="true">
        <div>
          <LoaderCircle className="mx-auto animate-spin text-cyan-400" size={52} strokeWidth={2.5} aria-hidden="true" />
          <h2 className="mt-5 font-display text-2xl font-bold uppercase text-white">
            {loginStep === 0 ? "Vérification des identifiants" : loginStep === 1 ? "Contrôle de sécurité" : "Authentification"}
          </h2>
          <p className="mt-2 text-sm text-zinc-400">Connexion sécurisée en cours…</p>
          <ol className="mx-auto mt-6 grid max-w-xs gap-3 text-left text-sm">
            {["Identifiants", "Contrôle de sécurité", "Authentification"].map((step, index) => (
              <li key={step} className={`flex items-center gap-3 ${index < loginStep ? "text-emerald-300" : index === loginStep ? "text-cyan-300" : "text-zinc-500"}`}>
                {index < loginStep ? (
                  <span className="grid size-5 place-items-center rounded-full bg-emerald-400/15" aria-hidden="true">
                    <Check size={13} strokeWidth={3} />
                  </span>
                ) : index === loginStep ? (
                  <LoaderCircle className="animate-spin text-cyan-300" size={18} aria-hidden="true" />
                ) : (
                  <Circle className="text-zinc-600" size={18} aria-hidden="true" />
                )}
                {step}
              </li>
            ))}
          </ol>
        </div>
      </section>
    )}
    </div>
  );
}
