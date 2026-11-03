import { TIRE_LABEL } from "./format";
import type { DynoConstraint, DynoMedal, UserCard } from "./types";

export interface DynoMedalModel {
  key: DynoMedal;
  label: string;
  coins: number;
  image: string;
  text: string;
  border: string;
  glow: string;
}

/** Paliers du Banc d'essai, du plus prestigieux au plus accessible. */
export const DYNO_MEDALS: DynoMedalModel[] = [
  {
    key: "gold",
    label: "Or",
    coins: 100,
    image: "/trophees/medaille_chrono_or.png",
    text: "text-yellow-300",
    border: "border-yellow-400/50",
    glow: "bg-yellow-400/10",
  },
  {
    key: "silver",
    label: "Argent",
    coins: 50,
    image: "/trophees/medaille_chrono_argent.png",
    text: "text-zinc-200",
    border: "border-zinc-300/40",
    glow: "bg-zinc-300/10",
  },
  {
    key: "bronze",
    label: "Bronze",
    coins: 20,
    image: "/trophees/medaille_chrono_bronze.png",
    text: "text-orange-300",
    border: "border-orange-600/50",
    glow: "bg-orange-600/10",
  },
];

export const DYNO_PARTICIPATION_COINS = 10;

export const dynoMedalModel = (key: DynoMedal) => DYNO_MEDALS.find((m) => m.key === key);

/** Médaille la plus haute atteinte pour un SP final donné. */
export function dynoMedalForSp(sp: number | null | undefined, thresholds: Record<DynoMedal, number>): DynoMedal | null {
  if (sp == null) return null;
  if (sp >= thresholds.gold) return "gold";
  if (sp >= thresholds.silver) return "silver";
  if (sp >= thresholds.bronze) return "bronze";
  return null;
}

export interface DynoDeckStats {
  powerHp: number;
  engineWeightKg: number;
  gearboxWeightKg: number;
  shiftTimeMs: number;
  tireType: string;
}

export interface DynoConstraintCheck {
  key: string;
  label: string;
  value: string;
  ok: boolean;
}

export function dynoDeckStats(engine?: UserCard, gearbox?: UserCard, tire?: UserCard): DynoDeckStats | null {
  if (!engine || !gearbox || !tire) return null;
  return {
    powerHp: engine.card_templates.power_hp ?? 0,
    engineWeightKg: engine.card_templates.weight_kg ?? 0,
    gearboxWeightKg: gearbox.card_templates.weight_kg ?? 0,
    shiftTimeMs: gearbox.card_templates.shift_time_ms ?? 0,
    tireType: tire.card_templates.tire_type ?? "",
  };
}

export function dynoDeckReady(engine?: UserCard, gearbox?: UserCard, tire?: UserCard): boolean {
  return Boolean(
    engine && gearbox && tire
    && !engine.is_destroyed && !gearbox.is_destroyed && !tire.is_destroyed,
  );
}

const tireLabel = (value: string) => TIRE_LABEL[value.toLowerCase()] ?? value;

/** Contrôles lisibles du deck équipé, dans l'ordre du défi. */
export function dynoConstraintChecks(constraints: DynoConstraint[], deck: DynoDeckStats | null): DynoConstraintCheck[] {
  return constraints.map((c, index) => {
    const key = `${c.type}-${index}`;
    switch (c.type) {
      case "tire_type":
        return {
          key,
          label: `Pneus ${tireLabel(c.value)}`,
          value: deck ? tireLabel(deck.tireType) : "—",
          ok: Boolean(deck && deck.tireType.toLowerCase() === c.value.toLowerCase()),
        };
      case "max_power_hp":
        return {
          key,
          label: "Puissance",
          value: deck ? `${deck.powerHp} ch / ${c.value} ch max` : `${c.value} ch max`,
          ok: Boolean(deck && deck.powerHp <= c.value),
        };
      case "max_weight_total_kg":
        return {
          key,
          label: "Poids total",
          value: deck ? `${deck.engineWeightKg + deck.gearboxWeightKg} kg / ${c.value} kg max` : `${c.value} kg max`,
          ok: Boolean(deck && deck.engineWeightKg + deck.gearboxWeightKg <= c.value),
        };
      case "max_engine_weight_kg":
        return {
          key,
          label: "Poids moteur",
          value: deck ? `${deck.engineWeightKg} kg / ${c.value} kg max` : `${c.value} kg max`,
          ok: Boolean(deck && deck.engineWeightKg <= c.value),
        };
      case "max_gearbox_weight_kg":
        return {
          key,
          label: "Poids boîte",
          value: deck ? `${deck.gearboxWeightKg} kg / ${c.value} kg max` : `${c.value} kg max`,
          ok: Boolean(deck && deck.gearboxWeightKg <= c.value),
        };
      case "min_shift_time_ms":
        return {
          key,
          label: "Temps de passage",
          value: deck ? `${deck.shiftTimeMs} ms / ${c.value} ms min` : `${c.value} ms min`,
          ok: Boolean(deck && deck.shiftTimeMs >= c.value),
        };
    }
  });
}

export const dynoConstraintsSatisfied = (checks: DynoConstraintCheck[]) => checks.every((c) => c.ok);
