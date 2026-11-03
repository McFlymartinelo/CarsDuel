"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createPushClient } from "@/lib/push-client";

/**
 * Garde l'abonnement push synchronisé et rafraîchit la cloche quand une
 * notification arrive pendant que l'app est ouverte.
 */
export function PushSync() {
  const router = useRouter();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const push = createPushClient();
    void push.sync();

    function onMessage(event: MessageEvent) {
      const data = event.data as
        | { type?: string; payload?: { url?: string } }
        | null;
      if (data?.type === "CARDSDUEL_PUSH") router.refresh();
      if (data?.type === "CARDSDUEL_PUSH_RESUBSCRIBE") void push.sync();
      if (data?.type === "CARDSDUEL_NAV" && data.payload?.url) router.push(data.payload.url);
    }

    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [router]);

  return null;
}
