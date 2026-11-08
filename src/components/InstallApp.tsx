"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Download, Share, Smartphone } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** Carte « Installer l'application » : invite native Android/desktop, consignes iOS. */
export function InstallApp() {
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setInstalled(isStandalone());
    setIos(isIos());

    function onBeforeInstall(event: Event) {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setPromptEvent(null);
      toast({ tone: "success", title: "CarsDuel est installée sur cet appareil.", key: "pwa-install" });
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [toast]);

  async function install() {
    if (!promptEvent || busy) return;
    setBusy(true);
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") {
        setInstalled(true);
        toast({ tone: "success", title: "Installation lancée.", key: "pwa-install" });
      }
      setPromptEvent(null);
    } catch {
      toast({ tone: "error", title: "L’installation n’a pas abouti. Réessayez depuis le menu du navigateur.", key: "pwa-install" });
    } finally {
      setBusy(false);
    }
  }

  if (installed) {
    return (
      <div id="installation" className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-emerald-400/40 bg-emerald-400/10 text-emerald-300">
          <CheckCircle2 size={20} strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold uppercase">Application installée</h2>
          <p className="mt-1 text-sm text-zinc-400">
            CarsDuel s’ouvre désormais comme une application, avec ses propres icône et fenêtre.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div id="installation" className="rounded-xl border border-line bg-panel p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300">
          <Smartphone size={20} strokeWidth={1.9} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-bold uppercase">Installer l’application</h2>
          <p className="mt-1 text-sm leading-snug text-zinc-400">
            Ajoutez CarsDuel à votre écran d’accueil : lancement plein écran, accès rapide et
            notifications hors app.
          </p>

          {ios ? (
            <ol className="mt-3 space-y-2 text-sm text-zinc-300">
              <li className="flex items-start gap-2">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white/[0.06] text-xs font-bold text-amber-300">1</span>
                <span className="flex flex-wrap items-center gap-1.5">
                  Touchez <Share size={15} strokeWidth={2} className="text-amber-300" aria-hidden /> Partager dans Safari.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white/[0.06] text-xs font-bold text-amber-300">2</span>
                Choisissez « Sur l’écran d’accueil », puis « Ajouter ».
              </li>
            </ol>
          ) : promptEvent ? (
            <button
              type="button"
              onClick={() => void install()}
              disabled={busy}
              className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-b from-accent-light to-accent px-4 font-display text-base font-bold uppercase tracking-wide text-black transition hover:brightness-110 disabled:opacity-50"
            >
              <Download size={17} strokeWidth={2.2} aria-hidden />
              {busy ? "Installation…" : "Installer l’application"}
            </button>
          ) : (
            <p className="mt-3 flex items-start gap-2 rounded-lg border border-line bg-panel-deep px-3 py-2 text-xs leading-relaxed text-zinc-400">
              <Download size={15} strokeWidth={1.9} className="mt-0.5 shrink-0 text-amber-300" aria-hidden />
              Ouvrez le menu du navigateur et choisissez « Installer l’application » ou « Ajouter à
              l’écran d’accueil ».
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
