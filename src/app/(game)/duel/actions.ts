"use server";

import { requireUser } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { callRpc, optStr, str } from "@/lib/rpc";
import { weatherNote } from "@/lib/format";
import { scoreMecaRaw, tireMalus, tireModifier } from "@/lib/game";
import type { ActionState, DuelOutcome, DuelReport, Weather } from "@/lib/types";

interface DetailRow {
  defender_name: string;
  engine_break_prob: number | null;
  gearbox_break_prob: number | null;
  engine_break_mod: number;
  gearbox_break_mod: number;
  e_power: number;
  e_weight: number;
  g_weight: number;
  g_shift: number;
  t_gum: number;
  t_type: string;
  perf_bonus_pct: number | null;
  engine_name: string | null;
  gearbox_name: string | null;
  tire_name: string | null;
  d_power: number | null;
  d_e_weight: number | null;
  d_g_weight: number | null;
  d_shift: number | null;
  d_gum: number | null;
  d_type: string | null;
}

/** Lance le duel (RPC, calcul 100 % côté base) puis relit les détails pour l'affichage. */
export async function launchDuel(_prev: ActionState<DuelReport>, fd: FormData): Promise<ActionState<DuelReport>> {
  const res = await callRpc<DuelOutcome>(
    "select public.execute_duel($1::uuid, $2::uuid, $3::uuid) as r",
    (id) => [id, str(fd, "deck_id"), optStr(fd, "bonus_id")],
    ["/", "/duel", "/garage", "/leaderboard"],
  );
  if (!res?.ok || !res.data) return { ok: false, message: res?.message };
  const o = res.data;

  const { user } = await requireUser();
  const { rows } = await withUser(user.id, (c) =>
    c.query<DetailRow>(
      `select p.username as defender_name, d.engine_break_prob, d.gearbox_break_prob,
              w.engine_break_mod, w.gearbox_break_mod,
              (d.snapshot->'attacker'->>'e_power')::numeric  as e_power,
              (d.snapshot->'attacker'->>'e_weight')::numeric as e_weight,
              (d.snapshot->'attacker'->>'g_weight')::numeric as g_weight,
              (d.snapshot->'attacker'->>'g_shift')::numeric  as g_shift,
              (d.snapshot->'attacker'->>'t_gum')::numeric    as t_gum,
              d.snapshot->'attacker'->>'t_type'              as t_type,
              m.perf_bonus_pct,
              te.name as engine_name, tg.name as gearbox_name, tt.name as tire_name,
              (d.snapshot->'defender'->>'e_power')::numeric  as d_power,
              (d.snapshot->'defender'->>'e_weight')::numeric as d_e_weight,
              (d.snapshot->'defender'->>'g_weight')::numeric as d_g_weight,
              (d.snapshot->'defender'->>'g_shift')::numeric  as d_shift,
              (d.snapshot->'defender'->>'t_gum')::numeric    as d_gum,
              d.snapshot->'defender'->>'t_type'              as d_type
         from duels_history d
         join public_profiles p on p.id = d.defender_id
         join weather_conditions w on w.weather = d.weather
         left join user_decks ad on ad.id = d.attacker_deck_id
         left join user_cards ce on ce.id = ad.engine_card_id
         left join card_templates te on te.id = ce.template_id
         left join user_cards cg on cg.id = ad.gearbox_card_id
         left join card_templates tg on tg.id = cg.template_id
         left join user_cards ct on ct.id = ad.tire_card_id
         left join card_templates tt on tt.id = ct.template_id
         left join tire_weather_modifiers m
                on m.weather = d.weather and m.tire_type::text = d.snapshot->'attacker'->>'t_type'
        where d.id = $1::uuid`,
      [o.duel_id],
    ),
  );
  const d = rows[0];
  if (!d) return { ok: true, data: undefined, message: "Duel effectué." };

  const bonusPct = d.perf_bonus_pct ?? 0;
  const effect = o.bonus;
  const broken = o.broken_part !== null;
  const report: DuelReport = {
    duelId: o.duel_id,
    weather: o.weather as Weather,
    weatherNote: weatherNote(o.weather as Weather, d.engine_break_mod, d.gearbox_break_mod),
    win: o.result === "attacker_win",
    brokenPart: o.broken_part,
    partSaved: o.part_saved,
    bonus: effect,
    attackerSp: o.attacker_sp,
    defenderSp: o.defender_sp,
    defenderName: d.defender_name,
    scoreMeca: scoreMecaRaw(d.e_power, d.e_weight + d.g_weight, d.g_shift),
    tireType: d.t_type,
    tireBonusPct: bonusPct,
    tireMalus: tireMalus(d.t_gum),
    tireMod: tireModifier(bonusPct, d.t_gum),
    engineProb: d.engine_break_prob,
    gearboxProb: d.gearbox_break_prob,
    coins: o.coins,
    xp: o.xp,
    gumBefore: d.t_gum,
    gumAfter: o.tire_gum_after,
    engineRun: !broken && effect !== "revision_express" && effect !== "revision_complete",
    gearboxRun: !broken && effect !== "vidange_boite" && effect !== "revision_complete",
    engineName: d.engine_name ?? "Moteur",
    gearboxName: d.gearbox_name ?? "Boîte",
    tireName: d.tire_name ?? "Pneus",
    yourPower: Number(d.e_power),
    yourEngineWeight: Number(d.e_weight),
    yourGearWeight: Number(d.g_weight),
    yourShift: Number(d.g_shift),
    ghostPower: Number(d.d_power ?? 0),
    ghostEngineWeight: Number(d.d_e_weight ?? 0),
    ghostGearWeight: Number(d.d_g_weight ?? 0),
    ghostShift: Number(d.d_shift ?? 0),
    ghostGum: Number(d.d_gum ?? 0),
    ghostTireType: d.d_type ?? "",
  };
  return { ok: true, data: report };
}
