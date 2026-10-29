"use server";

import { callRpc, str } from "@/lib/rpc";
import type { ActionState } from "@/lib/types";

export async function claimCollectorChallenge(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return callRpc(
    "select public.claim_collector_challenge($1::uuid, $2::text) as r",
    (id) => [id, str(fd, "challenge")],
    ["/", "/garage/collection"],
  );
}
