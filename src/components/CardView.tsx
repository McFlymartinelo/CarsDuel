import { ArrowUp, CloudDrizzle, CloudRain, CloudSun, Cog, Flag, Gauge, Joystick, Shield, ShieldCheck, Sun, Timer, TrendingDown, TriangleAlert, Trophy, Weight, Zap, type LucideIcon } from "lucide-react";
import { bonusEffectText, CATEGORY_LABEL, GEARBOX_LABEL, RARITY_LABEL, TIRE_THEME, WEATHER_LABEL } from "@/lib/format";
import { currentBreakRisk, warrantyState } from "@/lib/game";
import type { CardTemplate, Rarity, UserCard, Weather } from "@/lib/types";

const TIRE_WEATHERS: { weather: Weather; icon: LucideIcon }[] = [
  { weather: "sunny_hot", icon: Sun },
  { weather: "sunny_cool", icon: CloudSun },
  { weather: "rain_hot", icon: CloudRain },
  { weather: "rain_cool", icon: CloudDrizzle },
];

// Classes complètes (Tailwind ne détecte pas les noms assemblés dynamiquement).
export interface Theme {
  frame: string; // cadre extérieur + lueur
  inner: string; // liseré intérieur et séparateurs
  accent: string; // texte / icônes d'accent
  glow: string; // halo derrière l'image
}

export const THEME: Record<Rarity | "neutre", Theme> = {
  commune: { frame: "border-zinc-300/70 shadow-[0_0_22px_rgba(212,212,216,0.18)]", inner: "border-zinc-300/30", accent: "text-zinc-200", glow: "from-zinc-300/10" },
  rare: { frame: "border-blue-400/80 shadow-[0_0_22px_rgba(96,165,250,0.30)]", inner: "border-blue-400/30", accent: "text-blue-300", glow: "from-blue-400/15" },
  tres_rare: { frame: "border-cyan-400/80 shadow-[0_0_22px_rgba(34,211,238,0.30)]", inner: "border-cyan-400/30", accent: "text-cyan-300", glow: "from-cyan-400/15" },
  epique: { frame: "border-purple-400/80 shadow-[0_0_22px_rgba(192,132,252,0.35)]", inner: "border-purple-400/30", accent: "text-purple-300", glow: "from-purple-400/15" },
  legendaire: { frame: "border-orange-400/90 shadow-[0_0_26px_rgba(251,146,60,0.45)]", inner: "border-orange-400/35", accent: "text-orange-300", glow: "from-orange-400/20" },
  neutre: { frame: "border-zinc-500/70", inner: "border-zinc-500/30", accent: "text-zinc-300", glow: "from-zinc-400/10" },
};

interface Stat {
  icon: LucideIcon;
  label: string;
  value: string;
  valueClass?: string;
}

export interface TirePerf {
  tire_type: string;
  weather: string;
  perf_bonus_pct: number | string;
  wear_pct?: number | string | null;
}

/** 0.2 → "0.2", 830 → "830", 0.1000 → "0.1" (la base renvoie du numeric, parfois sous forme de chaîne). */
const num = (v: number | string | null | undefined) => (v == null ? "?" : String(Number(v)));
const pct = (v: number | string | null | undefined) => `${num(v)} %`;

function formatRisk(v: number): string {
  return `${Math.round(v * 100) / 100} %`;
}

function riskStyle(risk: number): { text: string; box: string } {
  if (risk >= 70) return { text: "text-red-400", box: "border-red-500/40 bg-red-500/10" };
  if (risk >= 40) return { text: "text-orange-300", box: "border-orange-500/40 bg-orange-500/10" };
  if (risk >= 15) return { text: "text-amber-300", box: "border-amber-500/40 bg-amber-500/10" };
  return { text: "text-emerald-400", box: "border-emerald-500/40 bg-emerald-500/10" };
}

function signedPct(v: number | string | null | undefined): { text: string; valueClass: string } {
  if (v == null || v === "") return { text: "?", valueClass: "text-white" };
  const n = Number(v);
  if (!Number.isFinite(n)) return { text: "?", valueClass: "text-white" };
  if (n > 0) return { text: `+${num(n)} %`, valueClass: "text-emerald-400" };
  if (n < 0) return { text: `−${num(Math.abs(n))} %`, valueClass: "text-red-400" };
  return { text: `${num(n)} %`, valueClass: "text-white" };
}

function statsOf(t: CardTemplate): Stat[] {
  switch (t.category) {
    case "moteur":
      return [
        { icon: Gauge, label: "Puissance", value: `${num(t.power_hp)} ch` },
        { icon: Weight, label: "Poids", value: `${num(t.weight_kg)} kg` },
        { icon: TriangleAlert, label: "Risque de casse initial", value: pct(t.base_break_risk) },
        { icon: ArrowUp, label: "Augmentation par duel", value: `+${pct(t.wear_sensitivity)}` },
      ];
    case "boite":
      return [
        { icon: Joystick, label: "Type", value: GEARBOX_LABEL[t.gearbox_type ?? ""] ?? t.gearbox_type ?? "?" },
        { icon: Timer, label: "Temps de passage", value: `${num(t.shift_time_ms)} ms` },
        { icon: Weight, label: "Poids", value: `${num(t.weight_kg)} kg` },
        { icon: TriangleAlert, label: "Risque de casse initial", value: pct(t.base_break_risk) },
        { icon: ArrowUp, label: "Augmentation par duel", value: `+${pct(t.wear_sensitivity)}` },
      ];
    default:
      return [{ icon: Zap, label: "Effet", value: bonusEffectText(t.bonus_effect, t.description) || "?" }];
  }
}

/** Usure par duel sur un couple chaud/froid. Une seule valeur si les deux se rejoignent. */
function wearOn(mods: TirePerf[], hot: Weather, cool: Weather): string {
  const at = (w: Weather) => mods.find((m) => m.weather === w)?.wear_pct;
  const h = at(hot);
  const c = at(cool);
  if (h == null && c == null) return "?";
  if (h == null) return pct(c);
  if (c == null || Number(h) === Number(c)) return pct(h);
  return `${pct(h)} chaud · ${pct(c)} froid`;
}

function StatList({ stats, accent }: { stats: Stat[]; accent: string }) {
  return (
    <ul className="space-y-2.5">
      {stats.map((s) => (
        <li key={s.label} className="flex items-start gap-3">
          <s.icon size={22} strokeWidth={1.5} className={`mt-1 shrink-0 ${accent}`} />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-zinc-400">{s.label}</p>
            <p className={`font-display text-lg font-semibold leading-tight ${s.valueClass ?? "text-white"}`}>{s.value}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function TireBlocks({ template, tirePerfs, accent }: { template: CardTemplate; tirePerfs: TirePerf[]; accent: string }) {
  const mods = tirePerfs.filter((m) => m.tire_type === template.tire_type);
  const wear: Stat[] = [
    { icon: Sun, label: "Piste sèche", value: wearOn(mods, "sunny_hot", "sunny_cool") },
    { icon: CloudRain, label: "Piste humide", value: wearOn(mods, "rain_hot", "rain_cool") },
  ];
  const performance: Stat[] = TIRE_WEATHERS.map(({ weather, icon }) => {
    const bonus = signedPct(mods.find((m) => m.weather === weather)?.perf_bonus_pct);
    return { icon, label: WEATHER_LABEL[weather], value: bonus.text, valueClass: bonus.valueClass };
  });

  return (
    <div className="relative mt-5 space-y-4">
      <section>
        <p className={`mb-2 flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-wider ${accent}`}>
          <TrendingDown size={16} strokeWidth={1.75} /> Usure
        </p>
        <StatList stats={wear} accent={accent} />
      </section>
      <section>
        <p className={`mb-2 flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-wider ${accent}`}>
          <Gauge size={16} strokeWidth={1.75} /> Gain de performance
        </p>
        <StatList stats={performance} accent={accent} />
      </section>
    </div>
  );
}

/** Code de référence lisible pour les pièces mécaniques : "m_1a" → "M1A", "b_5" → "B5" ; pneus/bonus → null. */
const cardCode = (code: string | null, category: CardTemplate["category"]) =>
  code && (category === "moteur" || category === "boite") ? code.replaceAll("_", "").toUpperCase() : null;

/**
 * Carte de collection : n° + catégorie, nom, rareté, stats avec jauges, visuel en filigrane.
 * L'instance (`card`) ajoute l'usure ; `children` (actions) s'affiche en pied de carte.
 */
export function CardView({
  template,
  card,
  image = null,
  tirePerfs = [],
  children,
}: {
  template: CardTemplate;
  card?: Pick<UserCard, "runs_count" | "runs_total" | "wins_count" | "tire_wear" | "is_listed" | "is_destroyed" | "warranty_used" | "warranty_duels" | "warranty_extended">;
  /** URL déjà résolue côté serveur (les fichiers du disque ne sont pas lisibles dans le navigateur). */
  image?: string | null;
  tirePerfs?: TirePerf[];
  children?: React.ReactNode;
}) {
  const rarity = template.rarity;
  const tireTheme = template.category === "pneus" ? TIRE_THEME[template.tire_type ?? ""] : undefined;
  const theme = rarity ? THEME[rarity] : tireTheme ?? THEME.neutre;
  const img = image;
  const reference = cardCode(template.code, template.category);
  const stats = statsOf(template);
  const bonus = template.category === "bonus";
  const headline = template.name;
  const badge = bonus ? null : rarity ? RARITY_LABEL[rarity] : null;

  const currentRisk = card ? currentBreakRisk(template, card.runs_count) : null;
  const riskTone = currentRisk !== null ? riskStyle(currentRisk) : null;
  const warranty = warrantyState(template, card);

  return (
    <div className={`relative h-full rounded-2xl border-2 bg-[#0b0d12] p-1.5 ${theme.frame}`}>
      <div className={`relative flex h-full min-h-[26rem] flex-col overflow-hidden rounded-xl border bg-gradient-to-b from-[#12151c] to-[#0a0c10] p-4 ${theme.inner}`}>
        {img ? (
          <>
            <div className={`pointer-events-none absolute -bottom-6 -right-8 h-3/5 w-4/5 rounded-full bg-gradient-to-t ${theme.glow} to-transparent blur-2xl`} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img} alt="" loading="lazy" decoding="async" fetchPriority="low" className="pointer-events-none absolute -bottom-4 -right-10 h-3/5 w-4/5 object-contain opacity-60 mix-blend-lighten" />
          </>
        ) : (
          <Cog aria-hidden strokeWidth={1} className={`pointer-events-none absolute -bottom-6 -right-6 h-44 w-44 opacity-10 ${theme.accent}`} />
        )}

        <div className="relative flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wider">
          <span className={`rounded-md border px-2.5 py-1 normal-case text-zinc-300 ${theme.inner}`}>{reference ?? "—"}</span>
          <span className={`min-w-0 flex-1 truncate rounded-md border px-2.5 py-1 text-center ${theme.inner} ${theme.accent}`}>{CATEGORY_LABEL[template.category]}</span>
        </div>

        <h3 className="relative mt-4 line-clamp-3 min-h-[4.95rem] font-display text-2xl font-bold uppercase leading-[1.1] tracking-wide text-white">{headline}</h3>

        {card && currentRisk !== null && (
          <div className="relative mt-3 flex flex-wrap items-center gap-1.5 text-xs">
            <span
              title={card.runs_total > 1 ? `${card.runs_total} runs réalisés` : `${card.runs_total} run réalisé`}
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-zinc-200 ${theme.inner}`}
            >
              <Flag size={13} className={theme.accent} />
              <span className="tabular-nums">{card.runs_total}</span>
              <span className="text-zinc-400">{card.runs_total > 1 ? "runs" : "run"}</span>
            </span>
            <span
              title={card.wins_count === 1 ? "1 victoire" : `${card.wins_count} victoires`}
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-zinc-200 ${theme.inner}`}
            >
              <Trophy size={13} className="text-amber-400" />
              <span className="tabular-nums">{card.wins_count}</span>
              <span className="text-zinc-400">{card.wins_count === 1 ? "victoire" : "victoires"}</span>
            </span>
          </div>
        )}

        {warranty && warranty.limit > 0 && (
          <div className="relative mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            <span
              title={
                card
                  ? warranty.expired
                    ? `Garantie constructeur expirée : ${warranty.used} run${warranty.used === 1 ? "" : "s"} couru${warranty.used === 1 ? "" : "s"} sur ${warranty.limit}`
                    : `Garantie constructeur : ${warranty.remaining} run${warranty.remaining === 1 ? "" : "s"} restant${warranty.remaining === 1 ? "" : "s"} sur ${warranty.limit}`
                  : `Garantie constructeur : ${warranty.limit} run${warranty.limit === 1 ? "" : "s"}`
              }
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 ${
                warranty.expired ? "border-red-500/40 text-red-300" : "border-emerald-500/40 text-emerald-300"
              }`}
            >
              <ShieldCheck size={13} />
              {warranty.expired ? (
                <span className="font-semibold">Garantie expirée</span>
              ) : (
                <span className="font-semibold">
                  {warranty.remaining} run{warranty.remaining === 1 ? "" : "s"} sous garantie restant{warranty.remaining === 1 ? "" : "s"}
                </span>
              )}
            </span>
            {warranty.repairable && (
              <span className="rounded-md border border-emerald-500/50 bg-emerald-500/10 px-2 py-1 font-semibold text-emerald-300">
                Réparable sous garantie
              </span>
            )}
          </div>
        )}

        {badge && (
          <div className={`relative mt-3 flex items-center gap-2 font-display text-lg font-semibold uppercase tracking-wider ${theme.accent}`}>
            <Shield size={26} strokeWidth={1.75} />
            {badge}
          </div>
        )}

        {riskTone && currentRisk !== null && (
          <div className={`relative mt-4 rounded-lg border px-3 py-2.5 ${riskTone.box}`}>
            <p className="text-xs uppercase tracking-wide text-zinc-400">Risque de casse actuel</p>
            <p className={`font-display text-3xl font-bold leading-none ${riskTone.text}`}>{formatRisk(currentRisk)}</p>
          </div>
        )}

        {template.category === "pneus" ? (
          <TireBlocks template={template} tirePerfs={tirePerfs} accent={theme.accent} />
        ) : bonus ? (
          <div className="relative mt-5">
            <p className={`mb-2 flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-wider ${theme.accent}`}>
              <Zap size={16} strokeWidth={1.75} /> Effet
            </p>
            <p className="text-sm leading-snug text-zinc-100">{bonusEffectText(template.bonus_effect, template.description)}</p>
          </div>
        ) : (
          <div className="relative mt-5">
            <StatList stats={stats} accent={theme.accent} />
          </div>
        )}

        {card?.tire_wear != null && (
          <p className="relative mt-4 font-display text-sm uppercase tracking-wide text-zinc-400">
            Gomme restante <span className="text-lg text-white">{num(card.tire_wear)} %</span>
          </p>
        )}
        {children && <div className="relative z-20 mt-auto pt-4">{children}</div>}
      </div>
      {card?.is_destroyed && (
        <div className="pointer-events-none absolute inset-4 z-10 flex items-center justify-center">
          <span className="-rotate-12 whitespace-nowrap border-4 border-red-600 px-2 py-0.5 font-display text-[clamp(1.5rem,3.6vw,2.35rem)] font-bold uppercase tracking-[0.08em] text-red-600">
            Détruite
          </span>
        </div>
      )}
    </div>
  );
}
