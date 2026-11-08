"use client";

import { useEffect, useRef } from "react";
import { useToast } from "@/components/ui/Toast";

/**
 * Enregistre le service worker et propose un rechargement quand une nouvelle
 * version attend. Aucun rechargement automatique : le joueur garde la main et
 * ne peut pas entrer dans une boucle de mise à jour.
 */
export function PwaManager() {
  const { toast } = useToast();
  const reloading = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    function offerUpdate(worker: ServiceWorker | null) {
      if (!worker || !navigator.serviceWorker.controller) return;
      toast({
        tone: "info",
        title: "Nouvelle version disponible",
        message: "Rechargez pour profiter des dernières améliorations.",
        duration: 0,
        key: "sw-update",
        action: {
          label: "Recharger",
          onClick: () => {
            reloading.current = true;
            worker.postMessage({ type: "SKIP_WAITING" });
            // Filet de sécurité si le navigateur ne déclenche pas controllerchange.
            window.setTimeout(() => {
              if (reloading.current) window.location.reload();
            }, 1500);
          },
        },
      });
    }

    function onControllerChange() {
      if (reloading.current) window.location.reload();
    }

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        if (cancelled) return;
        offerUpdate(registration.waiting);
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed") offerUpdate(registration.waiting || worker);
          });
        });
      })
      .catch(() => {
        // PWA indisponible : le jeu reste pleinement utilisable en ligne.
      });

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, [toast]);

  return null;
}
