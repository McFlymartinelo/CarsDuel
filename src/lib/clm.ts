import type { ClmMedal } from "./types";

export interface ClmMedalModel {
  key: ClmMedal;
  label: string;
  coins: number;
  threshold: number;
  image: string;
  text: string;
  border: string;
  glow: string;
}

/** Paliers de médailles, du plus prestigieux au plus accessible. */
export const CLM_MEDALS: ClmMedalModel[] = [
  {
    key: "gold",
    label: "Or",
    coins: 150,
    threshold: 290,
    image: "/trophees/medaille_chrono_or.png",
    text: "text-yellow-300",
    border: "border-yellow-400/50",
    glow: "bg-yellow-400/10",
  },
  {
    key: "silver",
    label: "Argent",
    coins: 70,
    threshold: 200,
    image: "/trophees/medaille_chrono_argent.png",
    text: "text-zinc-200",
    border: "border-zinc-300/40",
    glow: "bg-zinc-300/10",
  },
  {
    key: "bronze",
    label: "Bronze",
    coins: 30,
    threshold: 110,
    image: "/trophees/medaille_chrono_bronze.png",
    text: "text-orange-300",
    border: "border-orange-600/50",
    glow: "bg-orange-600/10",
  },
];

export const CLM_PARTICIPATION_COINS = 10;

export const clmMedalModel = (key: ClmMedal) => CLM_MEDALS.find((m) => m.key === key);

/** Médaille la plus haute atteinte pour un score final donné. */
export function clmMedalForSp(sp: number | null | undefined): ClmMedal | null {
  if (sp == null) return null;
  if (sp >= 290) return "gold";
  if (sp >= 200) return "silver";
  if (sp >= 110) return "bronze";
  return null;
}

const pad = (n: number, size: number) => String(n).padStart(size, "0");

/** Chrono au format course : MM'SS.mmm" (ex. 01'50.960" ou 07'59.960"). */
export function formatLapTime(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "--'--.---\"";
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const minutes = Math.floor(totalMs / 60_000);
  const secs = Math.floor((totalMs % 60_000) / 1000);
  const millis = totalMs % 1000;
  return `${pad(minutes, 2)}'${pad(secs, 2)}.${pad(millis, 3)}"`;
}

/** Écart de chrono signé, en secondes. */
export function formatLapDelta(seconds: number): string {
  const sign = seconds < 0 ? "−" : "+";
  return `${sign}${Math.abs(seconds).toLocaleString("fr-FR", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })} s`;
}

export const formatDistance = (km: number) =>
  `${km.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} km`;

/** Ajustement de la cible d'une médaille : T_base − seuil_SP / 10 × K_circuit. */
export function medalTargetSeconds(tBase: number, kCircuit: number, threshold: number): number {
  return tBase - (threshold / 10) * kCircuit;
}
