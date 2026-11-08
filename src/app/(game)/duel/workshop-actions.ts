"use server";

import { requireUser } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { invalidate } from "@/lib/rpc";
import { rpcErrorMessage } from "@/lib/errors";
import type { DrawnCard } from "@/lib/types";

export async function claimReconditionedPart(category: "moteur" | "boite" | "pneus") {
  const { user } = await requireUser();
  try {
    const draw = await withUser(user.id, async (c) => {
      const { rows } = await c.query<{ r: { template_id: string } }>(
        "select public.claim_reconditioned_part($1::uuid, $2::public.card_category) as r",
        [user.id, category],
      );
      if (category === "pneus") return undefined;
      const { rows: templates } = await c.query<{
        id: string; name: string; category: DrawnCard["category"]; rarity: DrawnCard["rarity"];
        power_hp: number | null; weight_kg: number | null; gearbox_type: string | null; shift_time_ms: number | null;
      }>("select id, name, category, rarity, power_hp, weight_kg, gearbox_type, shift_time_ms from card_templates where id = $1", [rows[0].r.template_id]);
      const t = templates[0];
      return {
        id: t.id, name: t.name, category: t.category, rarity: t.rarity, tireType: null, image: null,
        details: t.category === "moteur" ? [`${t.power_hp} ch`, `${t.weight_kg} kg`] : [t.gearbox_type ?? "", `${t.shift_time_ms} ms`],
      } satisfies DrawnCard;
    });
    invalidate(["/", "/duel", "/garage", "/garage/inventaire"]);
    return { ok: true as const, rewarded: true as const, draw };
  } catch (error) {
    if (error instanceof Error && error.message.includes("reconditioning_not_needed")) {
      return { ok: true as const, rewarded: false as const };
    }
    return { ok: false as const, message: rpcErrorMessage(error) };
  }
}
