"use server";

import { requireUser } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { callRpc, str } from "@/lib/rpc";
import type { ActionState } from "@/lib/types";

const VISITS = new Set(["inventaire", "boutique", "marketplace", "leaderboard"]);

export async function visitQuest(quest: string): Promise<void> {
  if (!VISITS.has(quest)) return;
  const { user } = await requireUser();
  await withUser(user.id, (c) => c.query("select public.touch_quest($1::uuid, $2::text)", [user.id, quest])).catch((e) => {
    console.error("quête indisponible :", e);
  });
}

export async function claimQuest(_prev: ActionState, fd: FormData): Promise<ActionState<{ coins: number }>> {
  return callRpc("select public.claim_daily_quest($1::uuid, $2::text) as r", (id) => [id, str(fd, "quest")], ["/"]);
}
