import type { DuelReport } from "./types";

export type DiagnosisTone = "good" | "bad" | "warn";

export type DiagnosisIcon = "wrench" | "gauge" | "tire" | "alert" | "flag";

export interface DiagnosisDelta {
  label: string;
  tone: DiagnosisTone;
}

export interface DiagnosisHint {
  label: string;
  href: string;
  icon: "wrench" | "tire" | "gauge";
}

export interface DuelDiagnosis {
  tone: DiagnosisTone;
  icon: DiagnosisIcon;
  eyebrow: string;
  title: string;
  reason: string;
  deltas: DiagnosisDelta[];
  hint?: DiagnosisHint;
}

/** En dessous, aucun facteur ne domine assez pour être mis en avant. */
const THRESHOLD = 2.5;
/** Deux facteurs à moins de 0,5 pt l'un de l'autre sont considérés à égalité. */
const TIE = 0.5;

/**
 * Miroir de TIRE_LABEL (src/lib/format.ts). Dupliqué ici volontairement :
 * ce module reste importable seul par les tests Node, sans résolution de
 * chemins TypeScript côté runtime.
 */
const TIRE_LABEL: Record<string, string> = {
  route: "Route",
  sport: "Sport",
  pluie: "Pluie",
  semi_slick: "Semi-slicks",
  slick: "Slicks",
};

type Factor = "tires" | "meca" | "gum";

const PRIORITY: Factor[] = ["tires", "meca", "gum"];

const f = (n: number, d = 1) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });

/** Préfixe + ou − (U+2212), sans signe pour zéro. */
function signed(n: number, d = 1): string {
  if (Math.abs(n) < 0.5 * 10 ** -d) return "0";
  return (n > 0 ? "+" : "−") + f(Math.abs(n), d);
}

const unit = (n: number) => (Math.abs(n) < 2 ? "pt" : "pts");

const tireLabel = (type: string) => TIRE_LABEL[type] ?? type;

/** Retient le facteur le plus marqué, avec priorité pneus > mécanique > gomme à égalité. */
function pickDominant(values: Record<Factor, number>): Factor | null {
  const best = Math.max(values.tires, values.meca, values.gum);
  if (!Number.isFinite(best) || best < THRESHOLD) return null;
  for (const factor of PRIORITY) {
    if (values[factor] >= best - TIE) return factor;
  }
  return null;
}

function diagnoseBreak(r: DuelReport): DuelDiagnosis {
  const isEngine = r.brokenPart === "moteur";
  const isGearbox = r.brokenPart === "boite";
  const prob = isEngine ? r.engineProb : isGearbox ? r.gearboxProb : null;
  const partTitle = isEngine ? "Casse moteur" : isGearbox ? "Casse boîte" : "Casse mécanique";

  const deltas: DiagnosisDelta[] = [];
  if (prob != null) {
    deltas.push({ label: `Risque ${f(prob, 1)} %`, tone: "bad" });
  } else {
    deltas.push({ label: "Risque non mesuré", tone: "warn" });
  }
  if (!isGearbox && r.gearboxProb === null) {
    deltas.push({ label: "Boîte non testée", tone: "warn" });
  }
  if (r.partSaved) deltas.push({ label: "Pièce sauvée", tone: "good" });
  if (deltas.length < 2) deltas.push({ label: "Course interrompue", tone: "warn" });

  const riskLine = prob != null ? `Le risque était de ${f(prob, 1)} %` : "Le risque n'était pas mesuré";

  if (r.partSaved) {
    return {
      tone: "good",
      icon: "wrench",
      eyebrow: "Le point de bascule",
      title: "Casse évitée par la garantie",
      reason: `${riskLine} : la garantie constructeur a pris en charge la réparation.`,
      deltas: deltas.slice(0, 3),
    };
  }

  return {
    tone: "warn",
    icon: "wrench",
    eyebrow: "Le point de bascule",
    title: partTitle,
    reason: prob != null
      ? `${riskLine} au départ : la casse a mis fin à la course avant le calcul final.`
      : "La casse a mis fin à la course avant le calcul final.",
    deltas: deltas.slice(0, 3),
    hint: { label: "Aller à l'atelier", href: "/garage", icon: "wrench" },
  };
}

function tireDeltas(r: DuelReport, fitEdge: number, mecaEdge: number): DiagnosisDelta[] {
  return [
    {
      label: `Pneus ×${f(r.tireMod, 2)} vs ×${f(r.ghostTireMod, 2)}`,
      tone: fitEdge >= 0 ? "good" : "bad",
    },
    {
      label: `Mécanique ${signed(mecaEdge, 1)} ${unit(mecaEdge)}`,
      tone: mecaEdge >= 0 ? "good" : "bad",
    },
  ];
}

function mechanicalDeltas(r: DuelReport): DiagnosisDelta[] {
  const powerDelta = r.yourPower - r.ghostPower;
  const shiftDelta = r.yourShift - r.ghostShift;
  const deltas: DiagnosisDelta[] = [
    { label: `${signed(powerDelta, 0)} ch`, tone: powerDelta >= 0 ? "good" : "bad" },
    { label: `${signed(shiftDelta, 0)} ms`, tone: shiftDelta <= 0 ? "good" : "bad" },
  ];
  if (Math.abs(r.tireMod - r.ghostTireMod) >= 0.02) {
    deltas.push({
      label: `Pneus ×${f(r.tireMod, 2)} vs ×${f(r.ghostTireMod, 2)}`,
      tone: r.tireMod >= r.ghostTireMod ? "good" : "bad",
    });
  }
  return deltas;
}

function gumDeltas(r: DuelReport): DiagnosisDelta[] {
  const gum = r.gumAfter ?? 100;
  return [
    {
      label: `Gomme ${f(gum, 0)} % vs ${f(r.ghostGum, 0)} %`,
      tone: gum >= r.ghostGum ? "good" : "bad",
    },
    {
      label: `Malus ${signed(-r.tireMalus, 0)} vs ${signed(-r.ghostTireMalus, 0)}`,
      tone: r.tireMalus <= r.ghostTireMalus ? "good" : "bad",
    },
  ];
}

function tightDeltas(r: DuelReport, mecaEdge: number, fitEdge: number): DiagnosisDelta[] {
  return [
    {
      label: `Écart ${f(Math.abs(mecaEdge), 1)} ${unit(mecaEdge)}`,
      tone: "warn",
    },
    {
      label: `Pneus ×${f(r.tireMod, 2)} vs ×${f(r.ghostTireMod, 2)}`,
      tone: fitEdge >= 0 ? "good" : "bad",
    },
  ];
}

function tiresReason(r: DuelReport, mecaEdge: number): string {
  const your = tireLabel(r.tireType);
  const ghost = tireLabel(r.ghostTireType);
  const mods = `×${f(r.tireMod, 2)} contre ×${f(r.ghostTireMod, 2)}`;

  if (r.win) {
    return `Vos ${your} rendent ${mods} pour ses ${ghost} : les pneus ont fait la course.`;
  }
  if (mecaEdge >= 1) {
    return `Votre mécanique est légèrement devant (${signed(mecaEdge, 1)} pt), mais vos ${your} rendent ${mods} pour ses ${ghost}. L'écart vient des pneus.`;
  }
  if (mecaEdge <= -1) {
    return `Votre mécanique accuse ${signed(mecaEdge, 1)} ${unit(mecaEdge)} et vos ${your} rendent ${mods} pour ses ${ghost} : les pneus ont aggravé l'écart.`;
  }
  return `Vos ${your} rendent ${mods} pour ses ${ghost}, sur une mécanique équivalente : l'écart vient des pneus.`;
}

function mechanicalReason(r: DuelReport): string {
  const powerDelta = r.yourPower - r.ghostPower;
  const shiftDelta = r.yourShift - r.ghostShift;
  const weightDelta = (r.ghostEngineWeight + r.ghostGearWeight) - (r.yourEngineWeight + r.yourGearWeight);

  if (r.win) {
    const base = Math.abs(powerDelta) < 0.5 && Math.abs(shiftDelta) < 0.5
      ? `Vous étiez ${f(Math.abs(weightDelta), 0)} kg plus ${weightDelta >= 0 ? "léger" : "lourd"}.`
      : `Vous aviez ${signed(powerDelta, 0)} ch et ${signed(shiftDelta, 0)} ms au passage.`;
    const tireGap = r.tireMod - r.ghostTireMod;
    if (Math.abs(tireGap) >= 0.02) {
      return `${base} Vos pneus étaient un peu ${tireGap < 0 ? "moins" : "plus"} affûtés (×${f(r.tireMod, 2)} contre ×${f(r.ghostTireMod, 2)}), mais la mécanique a largement compensé.`;
    }
    return `${base} La mécanique a largement compensé.`;
  }

  if (Math.abs(powerDelta) < 0.5 && Math.abs(shiftDelta) < 0.5) {
    return `Vous étiez ${f(Math.abs(weightDelta), 0)} kg plus ${weightDelta >= 0 ? "léger" : "lourd"} : la mécanique a creusé l'écart.`;
  }
  return `Vous perdiez ${signed(powerDelta, 0)} ch et ${signed(shiftDelta, 0)} ms au passage : la mécanique a creusé l'écart.`;
}

function gumReason(r: DuelReport, gumEdge: number): string {
  const gum = r.gumAfter ?? 100;
  const base = `Votre gomme est descendue à ${f(gum, 0)} % (malus ${signed(-r.tireMalus, 0)}) contre ${f(r.ghostGum, 0)} % chez l'adversaire`;
  if (r.win) return `${base} : l'usure a coûté ${f(Math.abs(gumEdge), 1)} ${unit(gumEdge)} à l'adversaire.`;
  return `${base} : l'usure a coûté ${f(Math.abs(gumEdge), 1)} ${unit(gumEdge)}.`;
}

function tightReason(r: DuelReport, mecaEdge: number, fitEdge: number): string {
  const tirePart = Math.abs(fitEdge) < 0.05
    ? "un écart de pneus limité"
    : `un écart de pneus limité (${f(Math.abs(fitEdge), 1)} ${unit(fitEdge)})`;
  return `Aucun facteur ne s'est détaché : ${f(Math.abs(mecaEdge), 1)} ${unit(mecaEdge)} d'écart au score mécanique et ${tirePart}.`;
}

/** Diagnostic factuel de fin de duel, calculé uniquement depuis le DuelReport. */
export function diagnoseDuel(r: DuelReport): DuelDiagnosis {
  if (r.brokenPart !== null) return diagnoseBreak(r);

  const mecaEdge = r.scoreMeca - r.ghostScoreMeca;
  // Modificateur « pur météo » : on retire la part d'usure du tireMod.
  const fitEdge = (r.tireMod - r.ghostTireMod + (r.tireMalus - r.ghostTireMalus) / 100) * r.scoreMeca;
  // Part de l'usure seule (malus exprimé en points de %).
  const gumEdge = ((r.ghostTireMalus - r.tireMalus) * r.scoreMeca) / 100;

  const factor = r.win
    ? pickDominant({ tires: fitEdge, meca: mecaEdge, gum: gumEdge })
    : pickDominant({ tires: -fitEdge, meca: -mecaEdge, gum: -gumEdge });

  if (factor === "tires") {
    return {
      tone: r.win ? "good" : "bad",
      icon: "tire",
      eyebrow: r.win ? "Ce qui a fait la différence" : "Le point de bascule",
      title: r.win
        ? "Les pneus ont fait la course"
        : r.weather === "rain_hot" || r.weather === "rain_cool"
          ? "Pneus inadaptés à la pluie"
          : "Pneus inadaptés au sec",
      reason: tiresReason(r, mecaEdge),
      deltas: tireDeltas(r, fitEdge, mecaEdge),
      hint: { label: "Changer de pneus", href: "/duel?slot=pneus", icon: "tire" },
    };
  }

  if (factor === "meca") {
    return {
      tone: r.win ? "good" : "bad",
      icon: "gauge",
      eyebrow: r.win ? "Ce qui a fait la différence" : "Le point de bascule",
      title: r.win ? "La mécanique a dominé" : "La mécanique a creusé l'écart",
      reason: mechanicalReason(r),
      deltas: mechanicalDeltas(r),
    };
  }

  if (factor === "gum") {
    return {
      tone: r.win ? "good" : "warn",
      icon: "alert",
      eyebrow: r.win ? "Ce qui a fait la différence" : "Le point de bascule",
      title: r.win ? "La gomme a tenu" : "Gomme en fin de vie",
      reason: gumReason(r, gumEdge),
      deltas: gumDeltas(r),
      hint: { label: "Changer de pneus", href: "/duel?slot=pneus", icon: "tire" },
    };
  }

  return {
    tone: r.win ? "good" : "warn",
    icon: "flag",
    eyebrow: "Analyse de la course",
    title: r.win ? "Victoire acquise de justesse" : "Course serrée",
    reason: tightReason(r, mecaEdge, fitEdge),
    deltas: tightDeltas(r, mecaEdge, fitEdge),
  };
}
