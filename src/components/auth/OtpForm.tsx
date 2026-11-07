"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Lock, ShieldCheck } from "lucide-react";
import type { ActionState } from "@/lib/types";
import type { OtpFlow, OtpPurpose, OtpResendData, OtpVerifyData } from "@/lib/auth-types";

type VerifyAction = (
  otpToken: string,
  code: string,
  flow: OtpFlow,
) => Promise<ActionState<OtpVerifyData>>;
type ResendAction = (otpToken: string) => Promise<ActionState<OtpResendData>>;

const SLOT_COUNT = 6;
const RADIUS_PCT = 38;

/** Positions régulières des 6 slots autour du cercle, premier slot en haut. */
function slotPosition(index: number) {
  const angle = ((-90 + index * (360 / SLOT_COUNT)) * Math.PI) / 180;
  return {
    left: `${50 + RADIUS_PCT * Math.cos(angle)}%`,
    top: `${50 + RADIUS_PCT * Math.sin(angle)}%`,
  };
}

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
  const [errorNonce, setErrorNonce] = useState(0);

  const activeIndex = Math.min(code.length, SLOT_COUNT - 1);

  // Compte à rebours du renvoi, remis à zéro par la réponse serveur.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  // Burst de succès puis redirection vers le chemin calculé côté serveur.
  // Le délai reste lisible même en `prefers-reduced-motion` : seule l'animation
  // décorative est coupée, pas le retour visuel de validation.
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
      reduce ? 1000 : 1200,
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
        setErrorNonce((value) => value + 1);
        window.setTimeout(focusInput, 0);
      }
    } catch {
      setError("La vérification a échoué. Réessayez dans un instant.");
      setCode("");
      setErrorNonce((value) => value + 1);
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
  const ringPosition = slotPosition(activeIndex);
  const tone = success ? "success" : error ? "error" : "idle";

  return (
    <section className="mx-auto w-full max-w-md rounded-xl border border-line bg-panel p-4 text-center sm:p-6">
      <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-amber-500">
        Vérification
      </p>
      <h2 className="mt-1 font-display text-2xl font-bold uppercase tracking-wide text-zinc-50">
        Code à 6 chiffres
      </h2>
      <p className="mt-2 text-sm text-zinc-400">
        {purpose === "register"
          ? "Confirmez votre adresse e-mail pour activer votre compte."
          : "Saisissez le code envoyé pour vous connecter."}
        <br />
        <span className="text-zinc-300">{emailMasked}</span>
      </p>

      {success && (
        <div
          role="status"
          aria-live="polite"
          className="mx-auto mt-3 flex max-w-xs items-center justify-center gap-2 rounded-lg border border-emerald-400/70 bg-emerald-400/10 px-3 py-2 text-sm font-semibold text-emerald-300 shadow-[0_0_24px_rgba(52,211,153,0.25)]"
        >
          <ShieldCheck size={18} aria-hidden="true" />
          Code validé — ouverture du garage…
        </div>
      )}

      <form
        className="mt-4"
        aria-busy={pending}
        onSubmit={(event) => {
          event.preventDefault();
          void submit(code);
        }}
      >
        <div className="relative mx-auto aspect-square w-[min(18rem,78vw)] select-none">
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

          <div className="otp-wheel-arrive absolute inset-0">
            <div
              key={errorNonce}
              role="presentation"
              onClick={focusInput}
              className={`absolute inset-0 ${error ? "otp-wheel-shake" : ""} ${success ? "otp-wheel-success" : ""}`}
            >
              <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">
                <circle
                  cx="50"
                  cy="50"
                  r={RADIUS_PCT}
                  fill="none"
                  stroke="#27272a"
                  strokeWidth="0.7"
                  strokeDasharray="1.6 2.4"
                />
                <circle
                  cx="50"
                  cy="50"
                  r={RADIUS_PCT}
                  fill="none"
                  stroke={tone === "success" ? "#34d399" : tone === "error" ? "#f87171" : "#f59e0b"}
                  strokeWidth="0.7"
                  strokeDasharray="1.6 2.4"
                  opacity="0.55"
                />
              </svg>

              {/* Halo de validation derrière le moyeu et les slots. */}
              {success && (
                <div
                  aria-hidden="true"
                  className="otp-success-halo pointer-events-none absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2 rounded-full"
                />
              )}

              {/* Moyeu central : ambre par défaut, émeraude après succès. */}
              <div
                aria-hidden="true"
                className={`absolute left-1/2 top-1/2 z-10 flex h-[4.5rem] w-[4.5rem] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 bg-panel-deep transition-colors ${
                  tone === "success"
                    ? "border-emerald-400 text-emerald-400 shadow-[0_0_28px_rgba(52,211,153,0.45)]"
                    : tone === "error"
                      ? "border-red-400 text-red-400 shadow-[0_0_28px_rgba(248,113,113,0.4)]"
                      : "border-amber-500 text-amber-400 shadow-[0_0_28px_rgba(245,158,11,0.4)]"
                }`}
              >
                {success ? <ShieldCheck size={34} aria-hidden="true" /> : <Lock size={30} aria-hidden="true" />}
              </div>

              {/* Anneau qui suit le slot actif. */}
              {!success && (
                <div
                  aria-hidden="true"
                  className="absolute z-10 h-[3.4rem] w-[3.4rem] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-500/90 bg-amber-500/10 shadow-[0_0_18px_rgba(245,158,11,0.45)] transition-[left,top] duration-300 ease-out motion-reduce:transition-none"
                  style={ringPosition}
                />
              )}

              {digits.map((digit, index) => {
                const isActive = index === activeIndex && !success;
                return (
                  <div
                    key={index}
                    aria-hidden="true"
                    style={slotPosition(index)}
                    className={`absolute z-20 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg border font-display text-xl font-bold sm:h-12 sm:w-12 sm:text-2xl ${
                      success
                        ? "border-emerald-400/80 bg-emerald-400/10 text-emerald-300"
                        : digit
                          ? "border-amber-500/70 bg-panel text-amber-300"
                          : isActive
                            ? "border-amber-400 bg-amber-500/10 text-amber-200"
                            : "border-line-strong bg-panel-deep text-zinc-500"
                    }`}
                  >
                    {digit || (isActive ? "·" : "")}
                  </div>
                );
              })}

              {success && (
                <div
                  aria-hidden="true"
                  className="otp-success-burst pointer-events-none absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2 rounded-full"
                />
              )}
            </div>
          </div>
        </div>

        <p className="mt-3 text-xs text-zinc-500">
          Cliquez sur la roue pour saisir le code. Le collage est accepté.
        </p>

        {error && (
          <p role="alert" aria-live="assertive" className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}
        {notice && !error && (
          <p aria-live="polite" className="mt-3 text-sm text-emerald-400">
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={pending || success}
          className="mt-4 min-h-11 w-full rounded-lg bg-amber-500 px-4 font-display text-lg font-bold uppercase tracking-wide text-black transition-colors hover:bg-amber-400 disabled:opacity-50"
        >
          {success ? "Code validé" : pending ? "Vérification…" : "Vérifier le code"}
        </button>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={resend}
            disabled={pending || success || cooldown > 0}
            className="min-h-10 rounded-lg border border-zinc-600 px-3 text-sm font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
          >
            {cooldown > 0 ? `Renvoyer le code (${cooldown} s)` : "Renvoyer le code"}
          </button>
          <button
            type="button"
            onClick={onBack}
            disabled={pending || success}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-line-strong px-3 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
          >
            <ArrowLeft size={15} aria-hidden="true" />
            {flow === "register" ? "Retour à l'inscription" : "Retour à la connexion"}
          </button>
        </div>
      </form>

      {process.env.NODE_ENV !== "production" && devCode && (
        <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-left text-xs text-amber-200">
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
    </section>
  );
}
