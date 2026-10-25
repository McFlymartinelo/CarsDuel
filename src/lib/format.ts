import { currentBreakRisk } from "./game";
import type { Category, CardTemplate, Rarity, UserCard, Weather } from "./types";

export const RARITY_LABEL: Record<Rarity, string> = {
  commune: "Commune",
  rare: "Rare",
  tres_rare: "Très rare",
  epique: "Épique",
  legendaire: "Légendaire",
};

export const RARITY_STYLE: Record<Rarity, string> = {
  commune: "border-zinc-500 text-zinc-300",
  rare: "border-blue-500 text-blue-300",
  tres_rare: "border-cyan-500 text-cyan-300",
  epique: "border-purple-500 text-purple-300",
  legendaire: "border-amber-400 text-amber-300",
};

/** Habillage des cartes de slot (garage) : cadre, lueur, pastille de rareté, couleur des valeurs. */
export const RARITY_THEME: Record<Rarity, { frame: string; glow: string; badge: string; label: string }> = {
  commune: { frame: "border-zinc-500", glow: "from-zinc-500/15", badge: "bg-zinc-600 text-white", label: "text-zinc-300" },
  rare: { frame: "border-blue-500", glow: "from-blue-500/20", badge: "bg-blue-500 text-white", label: "text-blue-400" },
  tres_rare: { frame: "border-cyan-500", glow: "from-cyan-500/20", badge: "bg-cyan-600 text-white", label: "text-cyan-400" },
  epique: { frame: "border-purple-500", glow: "from-purple-500/25", badge: "bg-purple-500 text-white", label: "text-purple-400" },
  legendaire: { frame: "border-amber-400", glow: "from-amber-400/25", badge: "bg-amber-500 text-black", label: "text-amber-400" },
};

export const WEATHER_SHORT: Record<Weather, string> = {
  sunny_hot: "Soleil chaud",
  sunny_cool: "Soleil frais",
  rain_hot: "Pluie chaude",
  rain_cool: "Pluie fraîche",
};

export const CATEGORY_LABEL: Record<Category, string> = {
  moteur: "Moteur",
  boite: "Boîte",
  pneus: "Pneus",
  bonus: "Bonus",
};

export const GEARBOX_LABEL: Record<string, string> = {
  manuelle: "Manuelle",
  sequentielle: "Séquentielle",
  double_embrayage: "Double embrayage",
  robotisee: "Robotisée",
  convertisseur: "Auto (convertisseur)",
  variation_continue: "Variation continue",
  multi_embrayages: "Multi-embrayages",
  dct_sequentielle: "Double embrayage / séquentielle",
};

export const WEATHER_LABEL: Record<Weather, string> = {
  sunny_hot: "Piste sèche et chaude",
  sunny_cool: "Piste sèche et froide",
  rain_hot: "Piste humide et chaude",
  rain_cool: "Piste humide et froide",
};

const duelLabel = (n: number) => `${n} duel${n > 1 ? "s" : ""}`;

export function cardSummary(t: CardTemplate, c?: Pick<UserCard, "runs_count" | "tire_wear">): string {
  switch (t.category) {
    case "moteur":
    case "boite": {
      const head = t.category === "moteur"
        ? `${t.architecture} · ${t.power_hp} ch · ${t.weight_kg} kg`
        : `${GEARBOX_LABEL[t.gearbox_type ?? ""] ?? t.gearbox_type} · ${t.shift_time_ms} ms · ${t.weight_kg} kg`;
      const risk = c ? currentBreakRisk(t, c.runs_count) : null;
      if (c && risk != null) return `${head} · ${duelLabel(c.runs_count)} · risque actuel ${Math.round(risk * 100) / 100} %`;
      return `${head} · risque initial ${t.base_break_risk} %`;
    }
    case "pneus":
      return `${t.tire_type} · usure nominale ${t.tire_base_wear}%/run${c?.tire_wear != null ? ` · gomme ${c.tire_wear}%` : ""}`;
    default:
      return bonusEffectText(t.bonus_effect, t.description);
  }
}

export const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date(iso));

/** Jour calendaire courant à Paris (YYYY-MM-DD), pour comparer à profiles.last_daily_pull. */
export const parisToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());

/** Lundi de la semaine ISO en cours à Paris (YYYY-MM-DD), pour profiles.last_weekly_pull. */
export function parisWeekStart(now = new Date()): string {
  const [y, m, d] = parisTodayParts(now);
  const utc = new Date(Date.UTC(y, m - 1, d));
  const dow = utc.getUTCDay();
  utc.setUTCDate(utc.getUTCDate() - (dow === 0 ? 6 : dow - 1));
  return utc.toISOString().slice(0, 10);
}

function parisTodayParts(now: Date): [number, number, number] {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const [y, m, d] = parts.split("-").map(Number);
  return [y, m, d];
}

export const TIRE_LABEL: Record<string, string> = {
  route: "Route",
  sport: "Sport",
  pluie: "Pluie",
  semi_slick: "Semi-slicks",
  slick: "Slicks",
};

/** Habillage des cartes pneu selon le type (cadre, accent, onglet, jante). */
export const TIRE_THEME: Record<string, { frame: string; inner: string; accent: string; glow: string; text: string; border: string; stroke: string }> = {
  route: {
    frame: "border-zinc-300/70 shadow-[0_0_22px_rgba(212,212,216,0.18)]",
    inner: "border-zinc-300/30",
    accent: "text-zinc-200",
    glow: "from-zinc-300/10",
    text: "text-zinc-300",
    border: "border-zinc-400",
    stroke: "stroke-zinc-400",
  },
  sport: {
    frame: "border-emerald-400/80 shadow-[0_0_22px_rgba(52,211,153,0.30)]",
    inner: "border-emerald-400/30",
    accent: "text-emerald-300",
    glow: "from-emerald-400/15",
    text: "text-emerald-400",
    border: "border-emerald-500",
    stroke: "stroke-emerald-500",
  },
  pluie: {
    frame: "border-blue-400/80 shadow-[0_0_22px_rgba(96,165,250,0.30)]",
    inner: "border-blue-400/30",
    accent: "text-blue-300",
    glow: "from-blue-400/15",
    text: "text-blue-400",
    border: "border-blue-500",
    stroke: "stroke-blue-500",
  },
  semi_slick: {
    frame: "border-red-400/80 shadow-[0_0_22px_rgba(248,113,113,0.35)]",
    inner: "border-red-400/30",
    accent: "text-red-300",
    glow: "from-red-400/15",
    text: "text-red-400",
    border: "border-red-500",
    stroke: "stroke-red-500",
  },
  slick: {
    frame: "border-purple-400/80 shadow-[0_0_22px_rgba(192,132,252,0.35)]",
    inner: "border-purple-400/30",
    accent: "text-purple-300",
    glow: "from-purple-400/15",
    text: "text-purple-400",
    border: "border-purple-500",
    stroke: "stroke-purple-500",
  },
};

export const BONUS_LABEL: Record<string, string> = {
  revision_express: "Révision express",
  vidange_boite: "Vidange de boîte",
  revision_complete: "Révision complète",
  huile_moteur_competition: "Huile moteur de compétition",
  huile_boite_competition: "Huile de boîte compétition",
  assistance_plateau: "Assistance plateau",
};

/** Effet joué, affiché sur la carte comme les stats d'un moteur ou d'une boîte. */
export const BONUS_EFFECT: Record<string, string> = {
  revision_express: "Gèle l'usure du moteur pour la course (le compteur de runs ne s'incrémente pas).",
  vidange_boite: "Gèle l'usure de la boîte pour la course (le compteur de runs ne s'incrémente pas).",
  revision_complete: "Gèle simultanément l'usure du moteur et de la boîte de vitesses.",
  huile_moteur_competition: "Multiplie par 0,5 le risque de casse calculé du moteur sur ce run (risque divisé par deux).",
  huile_boite_competition: "Multiplie par 0,5 le risque de casse calculé de la boîte sur ce run (risque divisé par deux).",
  assistance_plateau: "En cas d'échec au test de casse mécanique, le duel est perdu mais le composant cassé réintègre directement l'inventaire au lieu d'être envoyé au Musée de la casse.",
};

export function bonusEffectText(effect: string | null | undefined, description?: string | null): string {
  return (effect && BONUS_EFFECT[effect]) || description?.trim() || "";
}

function riskAmount(mod: number): string {
  const abs = Math.abs(Number(mod));
  if (!Number.isFinite(abs)) return "?";
  if (Number.isInteger(abs)) return String(abs);
  return abs.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
}

function breakRiskLine(part: "moteur" | "boîte", mod: number): string {
  const n = Number(mod);
  if (n < 0) return `Risque de casse ${part} diminué de ${riskAmount(n)} %`;
  if (n > 0) return `Risque de casse ${part} augmenté de ${riskAmount(n)} %`;
  return `Risque de casse ${part} inchangé`;
}

/** Phrase d'usure selon les pneus équipés. Absente si la météo ne change pas leur usure. */
export function tireWearLine(weather: Weather, tireType: string | null | undefined): string | null {
  if (!tireType) return null;
  const rainTire = tireType === "pluie";
  if (weather === "sunny_hot" && rainTire) return "Usure de vos pneus actuels multipliée par 2";
  if (weather === "sunny_cool" && rainTire) return "Usure de vos pneus actuels multipliée par 1,5";
  if ((weather === "rain_hot" || weather === "rain_cool") && !rainTire) return "Usure de vos pneus actuels divisée par 2";
  return null;
}

/** Effets de la météo, une idée par ligne. */
export function weatherEffects(w: Weather, engineMod: number, gearboxMod: number, tireType?: string | null): string[] {
  const lines = [breakRiskLine("moteur", engineMod), breakRiskLine("boîte", gearboxMod)];
  const wear = tireWearLine(w, tireType);
  if (wear) lines.push(wear);
  return lines;
}

/** Jour calendaire à Paris, décalé (1 = demain). */
function shiftParisDay(days: number, now = new Date()): Date {
  const [y, m, d] = parisTodayParts(now);
  const civil = new Date(Date.UTC(y, m - 1, d + days));
  return zonedToUtc(civil.getUTCFullYear(), civil.getUTCMonth() + 1, civil.getUTCDate(), 0, 0, 0);
}

function parisOffsetMs(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - instant.getTime();
}

function zonedToUtc(y: number, m: number, d: number, h: number, min: number, s: number): Date {
  const guess = new Date(Date.UTC(y, m - 1, d, h, min, s));
  const corrected = new Date(guess.getTime() - parisOffsetMs(guess));
  return new Date(guess.getTime() - parisOffsetMs(corrected));
}

/** Prochain minuit à Paris. */
export const nextParisMidnight = (now = new Date()) => shiftParisDay(1, now).toISOString();

/** Prochain lundi 00:00 à Paris. */
export function nextParisMonday(now = new Date()): string {
  const [y, m, d] = parisTodayParts(now);
  const utc = new Date(Date.UTC(y, m - 1, d));
  const dow = utc.getUTCDay();
  const add = dow === 0 ? 1 : dow === 1 ? 7 : 8 - dow;
  return shiftParisDay(add, now).toISOString();
}
