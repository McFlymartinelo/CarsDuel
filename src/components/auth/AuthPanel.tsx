"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Gift,
  Layers,
  Lock,
  Mail,
  ShieldCheck,
  Swords,
  Tag,
  User,
} from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { Logo } from "@/components/Logo";
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

type BaseProps = {
  signedIn?: boolean;
  /** Contrôle uniquement la vérification par code à l'inscription. */
  otpEnabled?: boolean;
  resendOtp: ResendAction;
  verifyOtp: VerifyAction;
};

type Props = BaseProps &
  (
    | { mode: "login"; signIn: CredentialsAction }
    | { mode: "register"; signUp: CredentialsAction }
  );

type Phase = "idle" | "loading" | "success";

const FEATURES = [
  {
    icon: Swords,
    title: "Duels fantômes",
    text: "Affronte les configurations des autres pilotes, quand tu veux.",
  },
  {
    icon: Layers,
    title: "Collection",
    text: "Moteurs, boîtes, pneus : assemble ta meilleure voiture.",
  },
  {
    icon: Tag,
    title: "Marketplace",
    text: "Achète, échange et revends tes cartes entre joueurs.",
  },
] as const;

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

/** Session créée sans OTP : redirection interne renvoyée par le serveur. */
function redirectFrom(state: ActionState): string | null {
  const data = state?.data as { redirectTo?: unknown } | undefined;
  return state?.ok && typeof data?.redirectTo === "string" ? data.redirectTo : null;
}

function usernameFrom(state: ActionState): string | null {
  const data = state?.data as { username?: unknown } | undefined;
  return typeof data?.username === "string" && data.username ? data.username : null;
}

export function AuthPanel(props: Props) {
  const { signedIn = false, otpEnabled = true, resendOtp, verifyOtp } = props;
  const isLogin = props.mode === "login";
  const credentialsAction = props.mode === "login" ? props.signIn : props.signUp;
  const router = useRouter();

  // Redirection uniquement si l'utilisateur était déjà connecté en arrivant :
  // après une connexion, le succès s'affiche et l'utilisateur continue lui-même.
  const wasSignedIn = useRef(signedIn);
  useEffect(() => {
    if (wasSignedIn.current) router.replace("/garage");
  }, [router]);

  const [phase, setPhase] = useState<Phase>("idle");
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [welcomeName, setWelcomeName] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const result = useRef<ActionState>(null);
  const minTimer = useRef<number | null>(null);
  const minElapsed = useRef(false);
  const revealRef = useRef<() => void>(() => {});

  const clearMinTimer = () => {
    if (minTimer.current !== null) {
      window.clearTimeout(minTimer.current);
      minTimer.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (minTimer.current !== null) {
        window.clearTimeout(minTimer.current);
        minTimer.current = null;
      }
    };
  }, []);

  /**
   * Déclenché dès la soumission native (avant l'action serveur) pour que les
   * feux de départ soient visibles même si la réponse revient très vite.
   */
  const startLoading = () => {
    clearMinTimer();
    result.current = null;
    minElapsed.current = false;
    revealRef.current = () => {};
    setChallenge(null);
    setRedirectTo(null);
    setWelcomeName(null);
    setPhase("loading");

    minTimer.current = window.setTimeout(() => {
      minTimer.current = null;
      minElapsed.current = true;
      revealRef.current();
    }, isLogin ? 1550 : 1450);
  };

  const handlePendingChange = (pending: boolean) => {
    if (pending) {
      startLoading();
      return;
    }

    const state = result.current;
    const nextChallenge = challengeFrom(state);
    const nextRedirect = redirectFrom(state);

    // Erreur de formulaire : on rend la main tout de suite.
    if (!nextChallenge && !nextRedirect) {
      clearMinTimer();
      setPhase("idle");
      return;
    }

    // La suite est révélée à la fin du temps minimum, que le serveur ait
    // répondu avant ou après les feux de départ.
    revealRef.current = () => {
      if (nextChallenge) {
        setChallenge(nextChallenge);
        setPhase("idle");
        return;
      }
      if (nextRedirect) {
        setRedirectTo(nextRedirect);
        setWelcomeName(usernameFrom(state));
        setPhase("success");
      }
    };

    if (minElapsed.current) revealRef.current();
  };

  const handleResult = (state: ActionState) => {
    result.current = state;
  };

  const enterGarage = () => {
    if (!redirectTo) return;
    router.replace(redirectTo);
    router.refresh();
  };

  const dataState =
    phase === "loading" ? "loading" : phase === "success" ? "success" : challenge ? "otp" : "form";

  return (
    <section className="auth-card" data-state={dataState}>
      <div className="auth-hero">
        <Logo size={86} className="auth-hero-logo" />
        <p className="auth-kicker">
          <span className="auth-leds" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
          Accès pilote
        </p>
        <h1>
          Le garage
          <br />
          est ouvert
        </h1>
        <p className="auth-hero-lead">
          Reprends le volant là où tu l’as laissé : un duel à lancer, un réglage à trouver, une carte
          à dénicher.
        </p>
        <ul className="auth-features">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li key={title}>
              <span className="auth-feature-icon">
                <Icon size={14} aria-hidden="true" />
              </span>
              <span>
                <strong>{title}</strong>
                <small>{text}</small>
              </span>
            </li>
          ))}
        </ul>
        <div className="auth-hero-art" aria-hidden="true" />
      </div>

      <div className="auth-form-side">
        <div className="contents" inert={phase !== "idle"}>
          {challenge ? (
            <OtpForm
              otpToken={challenge.otpToken}
              emailMasked={challenge.emailMasked}
              purpose={challenge.purpose}
              flow={props.mode}
              devOtp={challenge.devOtp}
              retryAfter={challenge.retryAfter}
              verifyAction={verifyOtp}
              resendAction={resendOtp}
              onBack={() => setChallenge(null)}
            />
          ) : (
            <>
              <div className="auth-pane-head">
                <h2>{isLogin ? "Bon retour au garage" : "Crée ton garage"}</h2>
                <p>
                  {isLogin
                    ? "Identifie-toi pour reprendre ta saison."
                    : "Ton kit de départ t’attend à l’inscription."}
                </p>
              </div>

              <div className="contents" onSubmitCapture={startLoading}>
                <ActionForm
                  action={credentialsAction}
                  submitLabel={
                    <>
                      {isLogin ? "Entrer dans le garage" : "Créer mon garage"}
                      <ArrowRight size={16} aria-hidden="true" />
                    </>
                  }
                  submitClassName="auth-cta"
                  variant="none"
                  className="auth-form"
                  onPendingChange={handlePendingChange}
                  onResult={handleResult}
                  feedback="inline"
                >
                {isLogin ? (
                  <>
                    <div className="auth-field">
                      <label className="auth-label" htmlFor="login-email">
                        Adresse e-mail
                      </label>
                      <div className="auth-control">
                        <Mail size={15} aria-hidden="true" />
                        <input
                          id="login-email"
                          className="auth-input"
                          name="email"
                          type="email"
                          placeholder="pilote@carsduel.fr"
                          autoComplete="email"
                          required
                        />
                      </div>
                    </div>
                    <div className="auth-field">
                      <label className="auth-label" htmlFor="login-password">
                        Mot de passe
                      </label>
                      <div className="auth-control">
                        <Lock size={15} aria-hidden="true" />
                        <input
                          id="login-password"
                          className="auth-input"
                          name="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Ton mot de passe"
                          autoComplete="current-password"
                          required
                        />
                        <button
                          type="button"
                          className="auth-eye"
                          onClick={() => setShowPassword((value) => !value)}
                          aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                          aria-pressed={showPassword}
                        >
                          {showPassword ? (
                            <EyeOff size={15} aria-hidden="true" />
                          ) : (
                            <Eye size={15} aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="auth-field">
                      <label className="auth-label" htmlFor="register-username">
                        Pseudo
                      </label>
                      <div className="auth-control">
                        <User size={15} aria-hidden="true" />
                        <input
                          id="register-username"
                          className="auth-input"
                          name="username"
                          type="text"
                          placeholder="Ton pseudo"
                          autoComplete="username"
                          minLength={3}
                          maxLength={24}
                          required
                        />
                      </div>
                    </div>
                    <div className="auth-field">
                      <label className="auth-label" htmlFor="register-email">
                        Adresse e-mail
                      </label>
                      <div className="auth-control">
                        <Mail size={15} aria-hidden="true" />
                        <input
                          id="register-email"
                          className="auth-input"
                          name="email"
                          type="email"
                          placeholder="pilote@carsduel.fr"
                          autoComplete="email"
                          required
                        />
                      </div>
                    </div>
                    <div className="auth-field">
                      <label className="auth-label" htmlFor="register-password">
                        Mot de passe
                      </label>
                      <div className="auth-control">
                        <Lock size={15} aria-hidden="true" />
                        <input
                          id="register-password"
                          className="auth-input"
                          name="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="8 caractères minimum"
                          autoComplete="new-password"
                          minLength={8}
                          maxLength={128}
                          required
                        />
                        <button
                          type="button"
                          className="auth-eye"
                          onClick={() => setShowPassword((value) => !value)}
                          aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                          aria-pressed={showPassword}
                        >
                          {showPassword ? (
                            <EyeOff size={15} aria-hidden="true" />
                          ) : (
                            <Eye size={15} aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="auth-kit">
                      <Gift size={16} aria-hidden="true" />
                      <span>
                        <strong>Kit de départ offert</strong>
                        <small>1 moteur · 1 boîte · 5 cartes bonus · 1 jeu de pneus</small>
                      </span>
                    </div>
                  </>
                )}
              </ActionForm>
              </div>

              {!isLogin && (
                <p className="auth-fineprint">
                  <ShieldCheck size={12} aria-hidden="true" />
                  <span>
                    {otpEnabled
                      ? "Un code à 6 chiffres confirme ton adresse e-mail à l’inscription."
                      : "La vérification par e-mail est temporairement en pause."}
                  </span>
                </p>
              )}

              <p className="auth-switch">
                {isLogin ? (
                  <>
                    Pas encore de garage ? <Link href="/auth/inscription">Créer un compte</Link>
                  </>
                ) : (
                  <>
                    Déjà pilote ? <Link href="/auth/login">Se connecter</Link>
                  </>
                )}
              </p>
            </>
          )}
        </div>

        {phase === "loading" && <LoadingLayer register={!isLogin} />}
        {phase === "success" && (
          <SuccessLayer register={!isLogin} username={welcomeName} onContinue={enterGarage} />
        )}
      </div>
    </section>
  );
}

function LoadingLayer({ register }: { register: boolean }) {
  return (
    <div className="auth-layer" role="status" aria-live="polite" aria-busy="true">
      <div className="auth-layer-inner">
        <div className="auth-lights" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((index) => (
            <i key={index} style={{ "--i": index } as CSSProperties} />
          ))}
        </div>
        <p className="auth-layer-kicker">{register ? "Inscription en cours" : "Connexion en cours"}</p>
        <h2 className="auth-layer-title">
          {register ? "Préparation du garage…" : "Ouverture du garage…"}
        </h2>
        <p className="auth-layer-sub">
          {register ? "On crée ton compte et ton kit de départ." : "On vérifie tes identifiants."}
        </p>
        <span className="auth-track" aria-hidden="true">
          <i />
        </span>
      </div>
    </div>
  );
}

function SuccessLayer({
  register,
  username,
  onContinue,
}: {
  register: boolean;
  username: string | null;
  onContinue: () => void;
}) {
  return (
    <div className="auth-layer is-success" role="status" aria-live="polite">
      <div className="auth-finish-strip" aria-hidden="true" />
      <div className="auth-success-burst" aria-hidden="true" />
      <div className="auth-layer-inner">
        <span className="auth-success-badge">
          <Check size={30} strokeWidth={3} aria-hidden="true" />
        </span>
        <p className="auth-layer-kicker">{register ? "Compte créé" : "Connexion réussie"}</p>
        <h2 className="auth-layer-title">
          {register ? "Ton garage t’attend" : username ? `Bon retour, ${username}` : "Bon retour au garage"}
        </h2>
        <p className="auth-layer-sub">
          {register
            ? "Ton kit de départ est prêt : 1 moteur, 1 boîte, 5 cartes bonus."
            : "Ton garage est prêt. Tu peux reprendre ta saison."}
        </p>
        <button type="button" className="auth-cta" onClick={onContinue} autoFocus>
          Entrer dans le garage <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
