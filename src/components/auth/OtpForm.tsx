"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, LoaderCircle, ShieldCheck } from "lucide-react";
import type { ActionState } from "@/lib/types";
import type { OtpFlow, OtpPurpose, OtpResendData, OtpVerifyData } from "@/lib/auth-types";

type VerifyAction = (
  otpToken: string,
  code: string,
  flow: OtpFlow,
) => Promise<ActionState<OtpVerifyData>>;
type ResendAction = (otpToken: string) => Promise<ActionState<OtpResendData>>;

const SLOT_COUNT = 6;

export function OtpForm({
  otpToken,
  emailMasked,
  purpose,
  flow,
  devOtp,
  retryAfter,
  verifyAction,
  resendAction,
  onBack,
}: {
  otpToken: string;
  emailMasked: string;
  purpose: OtpPurpose;
  flow: OtpFlow;
  devOtp?: string;
  retryAfter: number;
  verifyAction: VerifyAction;
  resendAction: ResendAction;
  onBack: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [token, setToken] = useState(otpToken);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [devCode, setDevCode] = useState(devOtp);
  const [cooldown, setCooldown] = useState(Math.max(0, retryAfter));

  // Compte à rebours du renvoi, remis à zéro par la réponse serveur.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  // Laisse le retour visuel de validation se jouer avant la redirection.
  useEffect(() => {
    if (!redirectTo) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(
      () => {
        router.push(redirectTo);
        router.refresh();
      },
      reduce ? 900 : 1200,
    );
    return () => window.clearTimeout(timer);
  }, [redirectTo, router]);

  function focusInput() {
    inputRef.current?.focus();
  }

  async function submit(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, SLOT_COUNT);
    if (digits.length !== SLOT_COUNT) {
      setError("Saisissez les 6 chiffres du code.");
      focusInput();
      return;
    }
    if (pending || success) return;

    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const result = await verifyAction(token, digits, flow);
      if (result?.ok && result.data?.redirectTo) {
        setSuccess(true);
        setRedirectTo(result.data.redirectTo);
      } else {
        setError(result?.message ?? "Code incorrect ou expiré. Demandez un nouveau code.");
        setCode("");
        window.setTimeout(focusInput, 0);
      }
    } catch {
      setError("La vérification a échoué. Réessayez dans un instant.");
      setCode("");
      window.setTimeout(focusInput, 0);
    } finally {
      setPending(false);
    }
  }

  function applyCode(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, SLOT_COUNT);
    setCode(digits);
    setError(null);
    setNotice(null);
    if (digits.length === SLOT_COUNT) void submit(digits);
  }

  async function resend() {
    if (pending || cooldown > 0 || success) return;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const result = await resendAction(token);
      if (result?.ok && result.data) {
        setToken(result.data.otpToken);
        setDevCode(result.data.devOtp);
        setCooldown(result.data.retryAfter);
        setCode("");
        setNotice("Un nouveau code vient d'être envoyé.");
        window.setTimeout(focusInput, 0);
      } else {
        setError(result?.message ?? "Impossible d'envoyer un nouveau code.");
        if (result?.data?.retryAfter) setCooldown(result.data.retryAfter);
      }
    } catch {
      setError("Impossible d'envoyer un nouveau code. Réessayez dans un instant.");
    } finally {
      setPending(false);
    }
  }

  const digits = Array.from({ length: SLOT_COUNT }, (_, index) => code[index] ?? "");
  const complete = code.length === SLOT_COUNT;

  return (
    <div className="auth-otp">
      <div className="auth-otp-inner">
        <button type="button" className="auth-back" onClick={onBack} disabled={pending || success}>
          <ArrowLeft size={14} aria-hidden="true" />
          {flow === "register" ? "Modifier l’e-mail" : "Retour à la connexion"}
        </button>

        <div className="auth-emblem">
          <ShieldCheck size={24} aria-hidden="true" />
        </div>
        <p className="auth-layer-kicker">Vérification</p>
        <h2 className="auth-layer-title">
          {success ? "Code validé" : purpose === "register" ? "Vérifie ton e-mail" : "Code de connexion"}
        </h2>
        <p className="auth-layer-sub">
          {purpose === "register"
            ? "Un code à 6 chiffres a été envoyé à"
            : "Saisis le code envoyé à"}{" "}
          <b>{emailMasked}</b>.
        </p>

        <form
          className="auth-otp-form"
          aria-busy={pending}
          onSubmit={(event) => {
            event.preventDefault();
            void submit(code);
          }}
        >
          <input
            ref={inputRef}
            value={code}
            onChange={(event) => applyCode(event.target.value)}
            onPaste={(event) => {
              event.preventDefault();
              applyCode(event.clipboardData.getData("text"));
            }}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={SLOT_COUNT}
            aria-label="Code de vérification à 6 chiffres"
            className="sr-only"
            disabled={pending || success}
            autoFocus
          />

          <div className="auth-digits" onClick={focusInput} role="group" aria-label="Code de vérification">
            {digits.map((digit, index) => {
              const filled = digit !== "";
              const isNext = !success && !pending && index === code.length;
              return (
                <span
                  key={index}
                  aria-hidden="true"
                  className={`auth-digit${filled ? " is-filled" : ""}${success ? " is-ok" : ""}${isNext ? " is-next" : ""}`}
                >
                  {digit}
                </span>
              );
            })}
          </div>

          {success ? (
            <p className="auth-otp-hint is-ok" role="status" aria-live="polite">
              <ShieldCheck size={13} aria-hidden="true" />
              Code validé — ouverture du garage…
            </p>
          ) : pending ? (
            <p className="auth-otp-hint" role="status" aria-live="polite">
              <LoaderCircle size={13} className="animate-spin" aria-hidden="true" />
              Vérification du code…
            </p>
          ) : (
            <p className="auth-otp-hint">Saisis les 6 chiffres reçus par e-mail.</p>
          )}

          {error && (
            <p role="alert" className="auth-error">
              {error}
            </p>
          )}
          {notice && !error && (
            <p className="auth-otp-notice" aria-live="polite">
              {notice}
            </p>
          )}

          <button type="submit" className="auth-cta" disabled={pending || success || !complete}>
            {success ? "Code validé" : pending ? "Vérification…" : "Valider le code"}
          </button>

          <button
            type="button"
            className="auth-resend"
            onClick={resend}
            disabled={pending || success || cooldown > 0}
          >
            {cooldown > 0 ? `Renvoyer le code dans ${cooldown} s` : "Renvoyer le code"}
          </button>
        </form>

        {process.env.NODE_ENV !== "production" && devCode && (
          <div className="auth-dev">
            <span className="font-semibold">Mode développement</span> — code de test :{" "}
            <code className="font-mono tracking-widest">{devCode}</code>
            <button
              type="button"
              onClick={() => applyCode(devCode)}
              className="ml-2 rounded border border-amber-500/60 px-2 py-0.5 font-medium hover:bg-amber-500/20"
            >
              Remplir
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
