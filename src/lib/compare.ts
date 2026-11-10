import { currentBreakRisk, scoreMeca, tireModifier } from "./game.ts";
import type { CardTemplate, UserCard, Weather } from "@/lib/types";

// Comparateur à l'achat : écart entre une pièce du catalogue / du marché et la
// pièce équipée sur le deck de référence (decks[0]). Calculé côté serveur, sans
// requête supplémentaire : la page fournit déjà le deck et les modificateurs.
//
// L'extension `.ts` de l'import ci-dessus est volontaire : les tests unitaires
// chargent ce module directement avec `node --test` (résolution ESM stricte).

export type CompareTone = "good" | "bad" | "neutral";

export interface CompareChip {
  label: string;
  tone: CompareTone;
}

export interface CardComparison {
  headline: string; // "+6,2 pts" | "−3,8 pts" | "+12 %"
  caption: string; // "de score mécanique estimé" | "de modificateur pneus (moyenne)"
  tone: "good" | "bad";
  reference: string; // nom de la pièce équipée correspondante
  chips: CompareChip[];
}

export interface EquippedPart {
  card: Pick<UserCard, "runs_count" | "tire_wear">;
  template: CardTemplate;
}

export interface EquippedConfig {
  engine: EquippedPart;
  gearbox: EquippedPart;
  tire: EquippedPart;
}

export interface TirePerfRow {
  tire_type: string;
  weather: string;
  perf_bonus_pct: number | string;
}

const WEATHERS: Weather[] = ["sunny_hot", "sunny_cool", "rain_hot", "rain_cool"];

const WEATHER_SHORT: Record<Weather, string> = {
  sunny_hot: "Sec chaud",
  sunny_cool: "Sec frais",
  rain_hot: "Humide chaud",
  rain_cool: "Humide frais",
};

/** Nombre au format français : 6.2 → « 6,2 », 14 → « 14 ». */
function f(n: number, digits: number): string {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Écart signé : « 0 » sous le seuil, sinon + ou − (U+2212) devant la valeur absolue. */
function signed(n: number, digits: number): string {
  if (Math.abs(n) < 0.05) return "0";
  return `${n > 0 ? "+" : "−"}${f(Math.abs(n), digits)}`;
}

/** « pt » au singulier (|v| < 2), « pts » au-delà. */
const ptLabel = (v: number) => (Math.abs(v) < 2 ? "pt" : "pts");

const toneOf = (v: number, betterWhenNegative = false): CompareTone => {
  if (Math.abs(v) < 0.05) return "neutral";
  return (v < 0) === betterWhenNegative ? "good" : "bad";
};

function engineLikeChips(
  template: CardTemplate,
  card: Pick<UserCard, "runs_count" | "tire_wear"> | null,
  equipped: EquippedPart,
  slot: "engine" | "gearbox",
): CompareChip[] {
  const chips: CompareChip[] = [];

  if (slot === "engine") {
    const power = (template.power_hp ?? 0) - (equipped.template.power_hp ?? 0);
    chips.push({ label: `${signed(power, 0)} ch`, tone: toneOf(power) });
  } else {
    const shift = (template.shift_time_ms ?? 0) - (equipped.template.shift_time_ms ?? 0);
    chips.push({ label: `${signed(shift, 0)} ms`, tone: toneOf(shift, true) });
  }

  // Plus léger = mieux : un poids supérieur est un malus.
  const weight = (template.weight_kg ?? 0) - (equipped.template.weight_kg ?? 0);
  chips.push({ label: `${signed(weight, 0)} kg`, tone: toneOf(weight, true) });

  const riskCandidate = currentBreakRisk(template, card?.runs_count ?? 0);
  const riskEquipped = currentBreakRisk(equipped.template, equipped.card.runs_count);
  if (riskCandidate !== null && riskEquipped !== null) {
    const risk = riskCandidate - riskEquipped;
    chips.push({ label: `risque ${signed(risk, 1)} ${ptLabel(risk)}`, tone: toneOf(risk, true) });
  }

  return chips;
}

/**
 * Écart d'une pièce candidate avec la configuration équipée.
 * Renvoie `null` quand il n'y a rien à comparer : bonus, même modèle que la
 * pièce équipée, pneus sans données météo complètes.
 */
export function compareCandidate(
  template: CardTemplate,
  card: Pick<UserCard, "runs_count" | "tire_wear"> | null,
  equipped: EquippedConfig,
  tirePerfs: TirePerfRow[],
): CardComparison | null {
  if (template.category === "bonus") return null;

  if (template.category === "moteur") {
    if (template.id === equipped.engine.template.id) return null;
    const before = scoreMeca(equipped.engine.template, equipped.gearbox.template);
    const after = scoreMeca(template, equipped.gearbox.template);
    const delta = after - before;
    return {
      headline: `${signed(delta, 1)} ${ptLabel(delta)}`,
      caption: "de score mécanique estimé",
      tone: delta >= 0 ? "good" : "bad",
      reference: equipped.engine.template.name,
      chips: engineLikeChips(template, card, equipped.engine, "engine"),
    };
  }

  if (template.category === "boite") {
    if (template.id === equipped.gearbox.template.id) return null;
    const before = scoreMeca(equipped.engine.template, equipped.gearbox.template);
    const after = scoreMeca(equipped.engine.template, template);
    const delta = after - before;
    return {
      headline: `${signed(delta, 1)} ${ptLabel(delta)}`,
      caption: "de score mécanique estimé",
      tone: delta >= 0 ? "good" : "bad",
      reference: equipped.gearbox.template.name,
      chips: engineLikeChips(template, card, equipped.gearbox, "gearbox"),
    };
  }

  // Pneus : comparaison météo par météo, moyenne affichée en chiffre principal.
  if (!template.tire_type) return null;
  if (template.id === equipped.tire.template.id) return null;

  const gumC = card?.tire_wear ?? 100;
  const gumE = equipped.tire.card.tire_wear ?? 100;
  const perf = new Map(tirePerfs.map((p) => [`${p.tire_type}|${p.weather}`, Number(p.perf_bonus_pct)]));

  const deltas = WEATHERS.map((w) => {
    const bc = perf.get(`${template.tire_type}|${w}`);
    const be = perf.get(`${equipped.tire.template.tire_type}|${w}`);
    if (bc == null || be == null) return null;
    return (tireModifier(bc, gumC) - tireModifier(be, gumE)) * 100;
  });
  if (deltas.some((d) => d === null)) return null;

  const values = deltas.map((d) => d as number);
  const average = values.reduce((sum, v) => sum + v, 0) / values.length;

  return {
    headline: `${signed(average, 1)} %`,
    caption: "de modificateur pneus (moyenne)",
    tone: average >= 0 ? "good" : "bad",
    reference: equipped.tire.template.name,
    chips: WEATHERS.map((w, i) => {
      const d = values[i];
      return { label: `${WEATHER_SHORT[w]} ${signed(d, 1)} %`, tone: toneOf(d) };
    }),
  };
}
