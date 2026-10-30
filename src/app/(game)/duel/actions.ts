"use server";

import { requireUser } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { callRpc, invalidate, str } from "@/lib/rpc";
import { rpcErrorMessage } from "@/lib/errors";
import { weatherEffects } from "@/lib/format";
import { scoreMecaRaw, tireMalus, tireModifier } from "@/lib/game";
import type { ActionState, DuelOutcome, DuelReport, Weather } from "@/lib/types";

interface DetailRow {
  attacker_name: string;
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
  d_perf: number | null;
  d_engine_name: string | null;
  d_gearbox_name: string | null;
  d_tire_name: string | null;
}

const DETAIL_SQL = `select ap.username as attacker_name, dp.username as defender_name,
        d.engine_break_prob, d.gearbox_break_prob, w.engine_break_mod, w.gearbox_break_mod,
        (d.snapshot->'attacker'->>'e_power')::numeric as e_power,
        (d.snapshot->'attacker'->>'e_weight')::numeric as e_weight,
        (d.snapshot->'attacker'->>'g_weight')::numeric as g_weight,
        (d.snapshot->'attacker'->>'g_shift')::numeric as g_shift,
        (d.snapshot->'attacker'->>'t_gum')::numeric as t_gum,
        d.snapshot->'attacker'->>'t_type' as t_type,
        m.perf_bonus_pct,
        te.name as engine_name, tg.name as gearbox_name, tt.name as tire_name,
        (d.snapshot->'defender'->>'e_power')::numeric as d_power,
        (d.snapshot->'defender'->>'e_weight')::numeric as d_e_weight,
        (d.snapshot->'defender'->>'g_weight')::numeric as d_g_weight,
        (d.snapshot->'defender'->>'g_shift')::numeric as d_shift,
        (d.snapshot->'defender'->>'t_gum')::numeric as d_gum,
        d.snapshot->'defender'->>'t_type' as d_type,
        gm.perf_bonus_pct as d_perf,
        dte.name as d_engine_name, dtg.name as d_gearbox_name, dtt.name as d_tire_name
   from duels_history d
   join public_profiles ap on ap.id = d.attacker_id
   join public_profiles dp on dp.id = d.defender_id
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
   left join user_decks dd on dd.id = d.defender_deck_id
   left join user_cards dce on dce.id = dd.engine_card_id
   left join card_templates dte on dte.id = dce.template_id
   left join user_cards dcg on dcg.id = dd.gearbox_card_id
   left join card_templates dtg on dtg.id = dcg.template_id
   left join user_cards dct on dct.id = dd.tire_card_id
   left join card_templates dtt on dtt.id = dct.template_id
   left join tire_weather_modifiers gm
          on gm.weather = d.weather and gm.tire_type::text = d.snapshot->'defender'->>'t_type'
  where d.id = $1::uuid`;

const num = (v: number | null | undefined) => Number(v ?? 0);

function buildReport(o: DuelOutcome, d: DetailRow, side: "attacker" | "defender"): DuelReport {
  const you = side === "attacker";
  const yourTire = (you ? d.t_type : d.d_type) ?? "";
  const theirTire = (you ? d.d_type : d.t_type) ?? "";
  const yourGum = num(you ? d.t_gum : d.d_gum);
  const theirGum = num(you ? d.d_gum : d.t_gum);
  const yourBonus = num(you ? d.perf_bonus_pct : d.d_perf);
  const theirBonus = num(you ? d.d_perf : d.perf_bonus_pct);
  const wearGum = you ? yourGum : 100;
  const effect = you ? o.bonus : null;
  return {
    duelId: o.duel_id,
    weather: o.weather as Weather,
    weatherLines: weatherEffects(o.weather as Weather, num(d.engine_break_mod), num(d.gearbox_break_mod), yourTire),
    win: you ? o.result === "attacker_win" : o.result === "defender_win",
    brokenPart: you ? o.broken_part : null,
    partSaved: you ? o.part_saved : false,
    bonus: effect,
    attackerSp: you ? o.attacker_sp : o.defender_sp,
    defenderSp: you ? o.defender_sp : o.attacker_sp,
    defenderName: you ? d.defender_name : d.attacker_name,
    scoreMeca: scoreMecaRaw(
      num(you ? d.e_power : d.d_power),
      num(you ? d.e_weight : d.d_e_weight) + num(you ? d.g_weight : d.d_g_weight),
      num(you ? d.g_shift : d.d_shift),
    ),
    tireType: yourTire,
    tireBonusPct: yourBonus,
    tireMalus: tireMalus(wearGum),
    tireMod: tireModifier(yourBonus, wearGum),
    engineProb: you ? d.engine_break_prob : null,
    gearboxProb: you ? d.gearbox_break_prob : null,
    coins: o.coins,
    xp: o.xp,
    gumAfter: you ? o.tire_gum_after : null,
    engineName: (you ? d.engine_name : d.d_engine_name) ?? "Moteur",
    gearboxName: (you ? d.gearbox_name : d.d_gearbox_name) ?? "Boîte",
    tireName: (you ? d.tire_name : d.d_tire_name) ?? "Pneus",
    yourPower: num(you ? d.e_power : d.d_power),
    yourEngineWeight: num(you ? d.e_weight : d.d_e_weight),
    yourGearWeight: num(you ? d.g_weight : d.d_g_weight),
    yourShift: num(you ? d.g_shift : d.d_shift),
    ghostPower: num(you ? d.d_power : d.e_power),
    ghostEngineWeight: num(you ? d.d_e_weight : d.e_weight),
    ghostGearWeight: num(you ? d.d_g_weight : d.g_weight),
    ghostShift: num(you ? d.d_shift : d.g_shift),
    ghostGum: theirGum,
    ghostTireType: theirTire,
    ghostScoreMeca: scoreMecaRaw(
      num(you ? d.d_power : d.e_power),
      num(you ? d.d_e_weight : d.e_weight) + num(you ? d.d_g_weight : d.g_weight),
      num(you ? d.d_shift : d.g_shift),
    ),
    ghostTireBonusPct: theirBonus,
    ghostTireMalus: you ? 0 : tireMalus(theirGum),
    ghostTireMod: tireModifier(theirBonus, you ? 100 : theirGum),
  };
}

async function loadDetail(duelId: string): Promise<DetailRow | undefined> {
  const { user } = await requireUser();
  const { rows } = await withUser(user.id, (c) => c.query<DetailRow>(DETAIL_SQL, [duelId]));
  return rows[0];
}

/** Lance le duel (RPC) puis relit les détails pour l'affichage. Le joueur est l'attaquant. */
export async function launchDuel(_prev: ActionState<DuelReport>, fd: FormData): Promise<ActionState<DuelReport>> {
  const deckId = str(fd, "deck_id");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(deckId)) {
    return { ok: false, message: "Votre configuration n'est plus disponible. Équipez un moteur, une boîte et des pneus avant de rejouer." };
  }
  const { user } = await requireUser();
  const { rows: configs } = await withUser(user.id, (c) =>
    c.query<{ engine_destroyed: boolean; gearbox_destroyed: boolean; tire_destroyed: boolean }>(
      `select ce.is_destroyed as engine_destroyed,
              cg.is_destroyed as gearbox_destroyed,
              ct.is_destroyed as tire_destroyed
         from user_decks d
         join user_cards ce on ce.id = d.engine_card_id
         join user_cards cg on cg.id = d.gearbox_card_id
         join user_cards ct on ct.id = d.tire_card_id
        where d.id = $1::uuid and d.owner_id = $2`,
      [deckId, user.id],
    ),
  );
  const config = configs[0];
  if (!config) return { ok: false, message: "Configuration introuvable. Vérifiez votre garage avant de relancer." };
  if (config.engine_destroyed) return { ok: false, message: "Votre moteur est détruit. Équipez-en un autre avant de lancer un duel." };
  if (config.gearbox_destroyed) return { ok: false, message: "Votre boîte est détruite. Équipez-en une autre avant de lancer un duel." };
  if (config.tire_destroyed) return { ok: false, message: "Vos pneus sont détruits. Équipez-en d'autres avant de lancer un duel." };
  let outcome: DuelOutcome | undefined;
  let detail: DetailRow | undefined;
  try {
    const result = await withUser(user.id, async (c) => {
      const { rows } = await c.query<{ r: DuelOutcome }>(
        "select public.execute_duel($1::uuid, $2::uuid, $3::uuid) as r",
        [user.id, deckId, str(fd, "bonus_id") || null],
      );
      const duel = rows[0]?.r;
      if (!duel) return { duel: undefined, detail: undefined };
      const { rows: details } = await c.query<DetailRow>(DETAIL_SQL, [duel.duel_id]);
      return { duel, detail: details[0] };
    });
    outcome = result.duel;
    detail = result.detail;
  } catch (e) {
    return { ok: false, message: rpcErrorMessage(e) };
  }
  if (!outcome) return { ok: false, message: "Le duel n'a pas renvoyé de résultat." };
  // Le duel change les runs, la garantie, l'usure, les pièces et l'XP :
  // on invalide le cache client des pages qui affichent ces données.
  invalidate(["/", "/garage", "/garage/inventaire", "/garage/casse", "/duel", "/leaderboard", "/marketplace"]);
  if (!detail) return { ok: true, data: undefined, message: "Duel effectué." };
  return { ok: true, data: buildReport(outcome, detail, "attacker") };
}

export async function proposeDuel(_prev: ActionState<{ username: string }>, fd: FormData): Promise<ActionState<{ username: string }>> {
  return callRpc<{ username: string }>(
    "select public.propose_duel($1::uuid, $2::text) as r",
    (id) => [id, str(fd, "username")],
    ["/", "/duel", "/duel/organises"],
  );
}

export async function declineDuel(fd: FormData): Promise<void> {
  await callRpc("select public.decline_duel($1::uuid, $2::uuid) as r", (id) => [id, str(fd, "challenge_id")], ["/duel", "/duel/organises"]);
}

export async function cancelDuel(fd: FormData): Promise<void> {
  await callRpc("select public.cancel_duel($1::uuid, $2::uuid) as r", (id) => [id, str(fd, "challenge_id")], ["/duel", "/duel/organises"]);
}

export type ArrangedPlay =
  | { kind: "duel"; report: DuelReport }
  | { kind: "forfeit"; name: string; coins: number; xp: number };

interface ArrangedOutcome extends DuelOutcome {
  forfeit: boolean;
  opponent: string;
}

/** Le joueur qui accepte est le défenseur. */
export async function acceptDuel(_prev: ActionState<ArrangedPlay>, fd: FormData): Promise<ActionState<ArrangedPlay>> {
  const res = await callRpc<ArrangedOutcome>(
    "select public.accept_duel($1::uuid, $2::uuid) as r",
    (id) => [id, str(fd, "challenge_id")],
    ["/", "/duel", "/duel/organises", "/garage", "/garage/inventaire", "/garage/casse", "/leaderboard", "/marketplace"],
  );
  if (!res?.ok || !res.data) return { ok: false, message: res?.message };
  const o = res.data;
  if (o.forfeit) return { ok: true, data: { kind: "forfeit", name: o.opponent, coins: o.coins, xp: o.xp } };
  const d = await loadDetail(o.duel_id);
  if (!d) return { ok: true, data: { kind: "forfeit", name: o.opponent, coins: o.coins, xp: o.xp } };
  return { ok: true, data: { kind: "duel", report: buildReport(o, d, "defender") } };
}
