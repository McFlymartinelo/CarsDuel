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

export function cardSummary(t: CardTemplate, c?: Pick<UserCard, "runs_count" | "tire_wear">): string {
  switch (t.category) {
    case "moteur":
      return `${t.architecture} · ${t.power_hp} ch · ${t.weight_kg} kg · R0 ${t.base_break_risk}% (+${t.wear_sensitivity}%/run)${c ? ` · ${c.runs_count} runs` : ""}`;
    case "boite":
      return `${GEARBOX_LABEL[t.gearbox_type ?? ""] ?? t.gearbox_type} · ${t.shift_time_ms} ms · ${t.weight_kg} kg · R0 ${t.base_break_risk}% (+${t.wear_sensitivity}%/run)${c ? ` · ${c.runs_count} runs` : ""}`;
    case "pneus":
      return `${t.tire_type} · usure nominale ${t.tire_base_wear}%/run${c?.tire_wear != null ? ` · gomme ${c.tire_wear}%` : ""}`;
    default:
      return t.description ?? "";
  }
}

export const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date(iso));

/** Jour calendaire courant à Paris (YYYY-MM-DD), pour comparer à profiles.last_daily_pull. */
export const parisToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());

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

const sgn = (n: number) => `${n > 0 ? "+" : "−"}${Math.abs(n).toLocaleString("fr-FR", { minimumFractionDigits: 1 })} %`;

/** Effets de la météo en une ligne (règles de la spec §3.C). */
export function weatherNote(w: Weather, engineMod: number, gearboxMod: number): string {
  const parts: string[] = [];
  if (engineMod !== 0) parts.push(`Casse moteur ${sgn(engineMod)}`);
  if (gearboxMod !== 0) parts.push(`casse boîte ${sgn(gearboxMod)}`);
  if (w === "sunny_hot") parts.push("pneus Pluie usure ×2");
  if (w === "sunny_cool") parts.push("pneus Pluie usure ×1,5");
  if (w === "rain_hot" || w === "rain_cool") parts.push("pneus non-pluie usure ×0,5");
  const text = parts.join(" · ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
