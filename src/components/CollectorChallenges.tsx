import { Boxes, Car, CircleDot, Cog, Coins, Cpu, Cylinder, Gauge, Layers, Lock, Package, Star, Trophy, Wrench, type LucideIcon } from "lucide-react";
import { CollectorAccordion } from "@/components/CollectorAccordion";
import { ChallengeDensityProvider, ChallengeDensityToggle } from "@/components/ChallengeDensity";
import { ChallengeTile } from "@/components/CollectorChallengeTile";
import type { CardTemplate } from "@/lib/types";

type Entry = { card_templates: CardTemplate; obtained: boolean };
type Challenge = {
  key: string;
  name: string;
  condition: string;
  coins: string;
  item: string;
  matches: (card: CardTemplate) => boolean;
  group: "rarity" | "engine";
  icon: LucideIcon;
};

const FINAL_REWARD = "5 000";
const PARTS = (card: CardTemplate) => card.category === "moteur" || card.category === "boite";
const engineCylinderCount = (architecture: string | null) =>
  architecture?.match(/(?:^|\b)(\d+)\s*cylindres?\b/i)?.[1]
  ?? architecture?.match(/\b[ V W H](\d+)\b/i)?.[1]
  ?? null;
const ENGINE_ICONS: Record<number, LucideIcon> = { 2: Cylinder, 3: Cog, 4: Boxes, 5: CircleDot, 6: Cpu, 8: Package, 10: Gauge, 12: Trophy, 16: Car };
const CHALLENGES: Challenge[] = [
  { key: "toolbox", name: "Boîte à outils", condition: "Posséder les 6 cartes bonus du jeu.", coins: "50", item: "Aucune", group: "rarity", icon: Wrench, matches: (c) => c.category === "bonus" },
  { key: "foundations", name: "Les Fondations", condition: "Posséder toutes les pièces de rareté Commune (moteurs et boîtes).", coins: "150", item: "1 pièce Rare aléatoire (moteur ou boîte)", group: "rarity", icon: Cog, matches: (c) => PARTS(c) && c.rarity === "commune" },
  { key: "track_prep", name: "Préparation Piste", condition: "Posséder toutes les pièces de rareté Rare (moteurs et boîtes).", coins: "400", item: "1 pièce Très Rare aléatoire (moteur ou boîte)", group: "rarity", icon: Cylinder, matches: (c) => PARTS(c) && c.rarity === "rare" },
  { key: "watchmaking", name: "Haute Horlogerie", condition: "Posséder toutes les pièces de rareté Très Rare (moteurs et boîtes).", coins: "1 000", item: "1 pièce Épique aléatoire (moteur ou boîte)", group: "rarity", icon: Gauge, matches: (c) => PARTS(c) && c.rarity === "tres_rare" },
  { key: "factory_team", name: "Écurie d'Usine", condition: "Posséder toutes les pièces de rareté Épique (moteurs et boîtes).", coins: "2 500", item: "1 pièce Légendaire aléatoire (moteur ou boîte)", group: "rarity", icon: Car, matches: (c) => PARTS(c) && c.rarity === "epique" },
  { key: "pantheon", name: "Le Panthéon", condition: "Posséder toutes les pièces de rareté Légendaire (moteurs et boîtes).", coins: "6 000", item: "Aucune", group: "rarity", icon: Trophy, matches: (c) => PARTS(c) && c.rarity === "legendaire" },
  ...[
    [2, "Le Clan du Bicylindre", "100"], [3, "Le Club du 3-Pattes", "200"], [4, "La Légion du 4-Cylindres", "400"],
    [5, "La Gamme Atypique", "500"], [6, "La Symphonie des 6", "750"], [8, "Le Mur du V8", "1 200"],
    [10, "La Rupture à 9000", "1 800"], [12, "L'Orfèvrerie Pure", "2 800"], [16, "Le Titan Cyberpunk", "4 500"],
  ].map(([cylinders, name, coins]) => ({
    key: `engine_${cylinders}`, name: String(name), condition: `Posséder tous les moteurs ${cylinders} cylindres.`, coins: String(coins), item: "Aucune", group: "engine" as const,
    icon: ENGINE_ICONS[Number(cylinders)] ?? Cog,
    matches: (c: CardTemplate) => c.category === "moteur" && engineCylinderCount(c.architecture) === String(cylinders),
  })),
];

const progressOf = (challenge: Challenge, entries: Entry[]) => {
  const cards = entries.filter(({ card_templates }) => challenge.matches(card_templates));
  const owned = cards.filter(({ obtained }) => obtained).length;
  return { total: cards.length, owned, complete: cards.length > 0 && owned === cards.length };
};

function Screw({ className }: { className: string }) {
  return <span aria-hidden="true" className={`pointer-events-none absolute h-2.5 w-2.5 rounded-full border border-zinc-600 bg-[#0b0d12] shadow-[inset_0_0_0_2px_#1a1d25] ${className}`} />;
}

function ChallengeGroup({ title, subtitle, challenges, entries, claimedChallenges, icon: Icon }: {
  title: string; subtitle: string; challenges: Challenge[]; entries: Entry[]; claimedChallenges: string[]; icon: LucideIcon;
}) {
  const done = challenges.filter((challenge) => progressOf(challenge, entries).complete).length;
  return <section className="relative min-w-0 rounded-xl border border-zinc-700/80 bg-[#0d1016]/95 p-3 shadow-[inset_0_0_30px_rgba(0,0,0,0.5)] sm:p-5">
    <Screw className="right-2 top-2" />
    <CollectorAccordion icon={<Icon aria-hidden="true" size={34} strokeWidth={1.2} className="shrink-0 text-amber-400" />} title={title} subtitle={subtitle} summary={`${done} / ${challenges.length}`}>
      {challenges.map((challenge) => {
        const { total, owned, complete } = progressOf(challenge, entries);
        const ChallengeIcon = challenge.icon;
        return <ChallengeTile
          key={challenge.key}
          challengeKey={challenge.key}
          name={challenge.name}
          condition={challenge.condition}
          item={challenge.item}
          reward={challenge.coins}
          owned={owned}
          total={total}
          complete={complete}
          claimed={claimedChallenges.includes(challenge.key)}
          icon={<ChallengeIcon aria-hidden="true" strokeWidth={1.4} className="h-6 w-6 sm:h-7 sm:w-7" />}
        />;
      })}
    </CollectorAccordion>
  </section>;
}

export function CollectorChallenges({ entries, claimedChallenges }: { entries: Entry[]; claimedChallenges: string[] }) {
  const rarity = CHALLENGES.filter((challenge) => challenge.group === "rarity");
  const engines = CHALLENGES.filter((challenge) => challenge.group === "engine");
  const completed = CHALLENGES.filter((challenge) => progressOf(challenge, entries).complete).length;
  const allDone = completed === CHALLENGES.length;
  const segments = CHALLENGES.length;

  return <section className="relative overflow-hidden rounded-2xl border border-amber-500/40 bg-[#0b0e14]/95 p-2.5 shadow-[0_0_0_1px_rgba(0,0,0,0.6),0_18px_55px_rgba(0,0,0,0.35)] sm:p-4">
    <Screw className="left-2 top-2" /><Screw className="right-2 top-2" /><Screw className="bottom-2 left-2" /><Screw className="bottom-2 right-2" />
    <div className="grid gap-3 lg:grid-cols-[minmax(19rem,0.85fr)_minmax(0,1.6fr)]">
      <aside className="relative isolate flex flex-col justify-between gap-6 overflow-hidden rounded-xl border border-zinc-700/80 bg-[#0d1016] p-4 sm:p-6 lg:min-h-[28rem]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 opacity-40" style={{ backgroundImage: "linear-gradient(rgba(148,163,184,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.07) 1px, transparent 1px)", backgroundSize: "26px 26px" }} />
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 top-[18%] -z-10 h-[24rem] w-[24rem] bg-[url('/cards/moteur/_v8.webp')] bg-contain bg-center bg-no-repeat opacity-[0.3] mix-blend-lighten grayscale lg:top-[30%]" style={{ maskImage: "linear-gradient(to left, black 40%, transparent)", WebkitMaskImage: "linear-gradient(to left, black 40%, transparent)" }} />
        <div>
          <div className="inline-flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.12em] text-amber-400"><Star size={18} strokeWidth={1.6} /> Défi principal</div>
          <h2 className="mt-4 max-w-[16rem] font-display text-3xl font-black uppercase leading-[1.05] tracking-wide text-zinc-100 sm:text-[2.6rem] lg:max-w-none lg:text-[2rem] xl:max-w-[22rem] xl:text-[2.6rem]">Défis du collectionneur</h2>
          <p className="mt-4 max-w-[15rem] text-sm leading-relaxed text-zinc-300">Complétez ces collections pour obtenir les récompenses indiquées.</p>
        </div>
        <div className="space-y-3">
          <div className="rounded-lg border border-zinc-700/80 bg-[#0b0e13]/90 px-4 py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 font-display uppercase"><span className="text-sm font-semibold tracking-wide text-zinc-200">Progression globale</span><span className="text-base font-bold text-amber-400">{completed} / {segments} défis</span></div>
            <div className="mt-3 flex gap-[2px] overflow-hidden rounded-full border border-zinc-700 bg-zinc-800/80 p-[2px]" role="progressbar" aria-valuemin={0} aria-valuemax={segments} aria-valuenow={completed}>
              {Array.from({ length: segments }, (_, i) => <span key={i} className={`h-2.5 flex-1 first:rounded-l-full last:rounded-r-full ${i < completed ? "bg-gradient-to-b from-amber-300 to-amber-500 shadow-[0_0_8px_rgba(251,191,36,0.55)]" : "bg-zinc-700/50"}`} />)}
            </div>
          </div>
          <div className={`flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border px-4 py-4 ${allDone ? "border-amber-400/70 bg-amber-500/10" : "border-amber-500/40 bg-[#0b0e13]/90"}`}>
            <Coins size={46} strokeWidth={1.2} className="shrink-0 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
            <div className="min-w-0">
              <p className="font-display text-xs font-semibold uppercase tracking-wide text-zinc-300">Récompense finale</p>
              <p className="font-display text-3xl font-black uppercase leading-tight text-amber-400">{FINAL_REWARD} <span className="text-lg">pièces</span></p>
            </div>
            <div className="flex w-full items-center gap-2 border-t border-zinc-800 pt-3 text-[11px] leading-snug text-zinc-400 sm:ml-auto sm:w-auto sm:border-0 sm:pt-0">
              <Lock size={20} strokeWidth={1.4} className="shrink-0 text-zinc-500" />
              <span className="sm:max-w-[6.5rem] xl:max-w-[5.75rem]">{allDone ? "Récompense débloquée." : "Terminez tous les défis du collectionneur."}</span>
            </div>
          </div>
        </div>
      </aside>
      <ChallengeDensityProvider>
        <div className="min-w-0 space-y-3">
          <ChallengeDensityToggle />
          <ChallengeGroup title="Collection par rareté" subtitle="Complétez chaque rareté pour obtenir les récompenses indiquées." challenges={rarity} entries={entries} claimedChallenges={claimedChallenges} icon={Layers} />
          <ChallengeGroup title="Architectures moteur" subtitle="Complétez chaque type de moteur pour obtenir les récompenses indiquées." challenges={engines} entries={entries} claimedChallenges={claimedChallenges} icon={Cog} />
        </div>
      </ChallengeDensityProvider>
    </div>
  </section>;
}
