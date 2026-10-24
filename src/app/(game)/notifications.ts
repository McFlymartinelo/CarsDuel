"use server";

import { callRpc } from "@/lib/rpc";
import type { ActionState } from "@/lib/types";

/** Marque tout comme lu. Revalide le layout : le badge du Nav se remet à zéro. */
export async function markNotificationsSeen(): Promise<ActionState> {
  return callRpc("select public.mark_notifications_seen($1::uuid) as r", (id) => [id]);
}
