"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, BellOff, Loader2, Send, Smartphone } from "lucide-react";
import { createPushClient, type PushEnableResult, type PushStatus } from "@/lib/push-client";

const ENABLE_ERRORS: Record<NonNullable<PushEnableResult["reason"]>, string> = {
  "ios-install":
    "Sur iPhone, ajoutez CarsDuel à l'écran d'accueil (Partager → Sur l'écran d'accueil), puis ouvrez l'app.",
  unsupported: "Ce navigateur ne gère pas les notifications push.",
  vapid: "Push non configuré sur le serveur : les clés VAPID sont manquantes.",
  denied: "Permission refusée. Autorisez CarsDuel dans les réglages du navigateur.",
  error: "Impossible de créer l'abonnement push. Réessayez plus tard.",
};

function hintFor(status: PushStatus | null): string | null {
  if (!status) return "Vérification de l'état…";
  if (status.needsInstall) {
    return "Sur iPhone : Partager → Sur l'écran d'accueil, puis ouvrez CarsDuel.";
  }
  if (!status.supported) return "Ce navigateur ne gère pas les notifications push.";
  if (!status.vapidConfigured) return "Push non configuré sur le serveur (clés VAPID manquantes).";
  if (status.permission === "denied") {
    return "Permission refusée : autorisez CarsDuel dans les réglages du navigateur.";
  }
  if (status.subscribed) return "Actives sur cet appareil.";
  return "Inactives sur cet appareil.";
}

export function PushSettings() {
  const client = useMemo(() => createPushClient(), []);
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      setStatus(await client.status());
    } catch {
      setStatus(null);
    }
  }, [client]);

  useEffect(() => {
    let alive = true;
    void client.status().then((next) => {
      if (alive) setStatus(next);
    }).catch(() => {
      if (alive) setStatus(null);
    });
    return () => {
      alive = false;
    };
  }, [client]);

  async function enable() {
    setBusy(true);
    setMessage(null);
    const result = await client.enable();
    setBusy(false);

    if (!result.ok) {
      const reason = result.reason ?? "error";
      setMessage({
        ok: false,
        text: reason === "error" && result.error ? result.error : ENABLE_ERRORS[reason],
      });
      await refresh();
      return;
    }

    await refresh();
    setMessage({
      ok: true,
      text: "Notifications activées : un push de confirmation vient d'être envoyé.",
    });
  }

  async function disable() {
    setBusy(true);
    setMessage(null);
    await client.disable();
    setBusy(false);
    await refresh();
    setMessage({ ok: true, text: "Notifications désactivées sur cet appareil." });
  }

  async function test() {
    setBusy(true);
    setMessage(null);

    try {
      const result = await client.test();
      if (result.sent > 0) {
        setMessage({ ok: true, text: "Push de test envoyé. Vérifiez votre écran verrouillé." });
      } else if (result.skipped) {
        setMessage({
          ok: false,
          text: "Aucun appareil abonné. Désactivez puis réactivez les notifications.",
        });
      } else {
        setMessage({
          ok: false,
          text: "Le serveur n'a pas pu joindre l'appareil. Réactivez l'abonnement et réessayez.",
        });
      }
    } catch (error) {
      setMessage({
        ok: false,
        text: error instanceof Error ? error.message : "Test push impossible.",
      });
    } finally {
      setBusy(false);
    }
  }

  const subscribed = Boolean(status?.subscribed);
  const hint = hintFor(status);

  return (
    <div id="notifications" className="rounded-xl border border-zinc-800 bg-[#10131a] p-4">
      <div className="flex items-start gap-3">
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${
            subscribed
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
              : "border-zinc-700 bg-zinc-900 text-zinc-400"
          }`}
        >
          {subscribed ? <Bell size={20} strokeWidth={1.9} /> : <BellOff size={20} strokeWidth={1.9} />}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-xl font-bold uppercase">Notifications hors app</h2>
            <span
              className={`h-2 w-2 rounded-full ${
                subscribed ? "bg-emerald-400" : status ? "bg-zinc-500" : "bg-amber-400"
              }`}
              aria-hidden
            />
          </div>

          <p className="mt-1 text-sm leading-snug text-zinc-400">
            Offres, ventes, duels et primes de classement, même quand CarsDuel est fermé.
          </p>

          {hint ? (
            <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/70 px-2.5 py-2 text-xs leading-snug text-zinc-400">
              <Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {hint}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            {subscribed ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void disable()}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-zinc-700 px-4 font-display text-base font-bold uppercase text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <BellOff size={16} />}
                Désactiver
              </button>
            ) : (
              <button
                type="button"
                disabled={busy || !status || status.needsInstall || !status.supported || !status.vapidConfigured}
                onClick={() => void enable()}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-amber-500 px-4 font-display text-base font-bold uppercase text-black hover:bg-amber-400 disabled:opacity-50"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Bell size={16} />}
                Activer
              </button>
            )}

            <button
              type="button"
              disabled={busy || !subscribed}
              onClick={() => void test()}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-zinc-700 px-4 font-display text-base font-bold uppercase text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Tester
            </button>
          </div>

          {message ? (
            <p
              aria-live="polite"
              className={`mt-3 text-sm ${message.ok ? "text-emerald-400" : "text-red-400"}`}
            >
              {message.text}
            </p>
          ) : null}

          <p className="mt-3 text-xs leading-snug text-zinc-500">
            L&apos;abonnement est lié à cet appareil. Vous pouvez le désactiver à tout moment ; les
            notifications dans l&apos;app restent disponibles.
          </p>
        </div>
      </div>
    </div>
  );
}
