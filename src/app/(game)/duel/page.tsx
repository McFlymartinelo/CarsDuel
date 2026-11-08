import { Suspense } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { DailyQuests } from "@/components/DailyQuests";
import { DuelForm } from "@/components/DuelForm";
import { ClmForm } from "@/components/ClmForm";
import { DynoForm } from "@/components/DynoForm";
import { ConfigConstructeurForm } from "@/components/ConfigConstructeurForm";
import { ReconditioningWorkshop } from "./ReconditioningWorkshop";
import { ChallengeList, ProposeDuel } from "@/components/OrganizedDuels";
import { ConfigBoard } from "@/components/garage/ConfigBoard";
import { ConfigDisclosure } from "@/components/garage/ConfigDisclosure";
import { ConfigSummary } from "@/components/garage/ConfigSummary";
import { SummaryPanel } from "@/components/garage/SummaryPanel";
import { type SlotKey } from "@/components/garage/SlotTabs";
import { DuelHistory, DuelHistorySkeleton } from "@/components/duel/DuelHistory";
import { cardImageUrl } from "@/lib/card-images";
import { parsePage } from "@/lib/pagination";
import { getDailyQuests, loadClmChallenge, loadConfigChallenge, loadDuelPage, loadDynoChallenge, loadOrganizedChallenges } from "@/lib/queries";
import { launchClm, launchDuel, launchDyno, validateConfigPair } from "./actions";

export const metadata = { title: "Jouer — CarsDuel" };

const SLOTS: SlotKey[] = ["moteur", "boite", "pneus"];

export default async function DuelPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; slot?: string; config?: string }>;
}) {
  const { page: pageParam, slot: slotParam, config: configParam } = await searchParams;
  const page = parsePage(pageParam);
  const { user } = await requireUser();
  const [{ cards: allCards, decks: allDecks, modifiers }, quests, organized, clm, dyno, configs, workshopStock] = await Promise.all([
    loadDuelPage(user.id),
    getDailyQuests(user.id).catch((e) => {
      console.error("défis indisponibles :", e);
      return null;
    }),
    loadOrganizedChallenges(user.id).catch((e) => {
      console.error("demandes de duel indisponibles :", e);
      return null;
    }),
    loadClmChallenge(user.id).catch((e) => {
      console.error("contre-la-montre indisponible :", e);
      return null;
    }),
    loadDynoChallenge(user.id).catch((e) => {
      console.error("banc d'essai indisponible :", e);
      return null;
    }),
    loadConfigChallenge(user.id).catch((e) => {
      console.error("configs constructeur indisponibles :", e);
      return null;
    }),
    withUser(user.id, async (c) => {
      const { rows } = await c.query<{ category: string; count: number }>(
        `select t.category::text as category, count(*)::int as count
           from user_cards uc join card_templates t on t.id = uc.template_id
          where uc.owner_id = $1 and not uc.is_destroyed
            and (t.category <> 'pneus' or coalesce(uc.tire_wear, 0) > 0)
          group by t.category`, [user.id]);
      return Object.fromEntries(rows.map((r) => [r.category, r.count]));
    }).catch((e) => {
      console.error("patrimoine atelier indisponible :", e);
      return { moteur: -1, boite: -1, pneus: -1 } as Record<string, number>;
    }),
  ]);
  const cards = allCards.filter((x) => !x.is_destroyed && !x.is_listed);
  const alive = new Set(cards.map((x) => x.id));
  const config = allDecks[0];
  const bonuses = cards
    .filter((x) => x.card_templates.category === "bonus")
    .map((x) => ({ ...x, image: cardImageUrl(x.card_templates) }));
  const slot: SlotKey = SLOTS.includes(slotParam as SlotKey) ? (slotParam as SlotKey) : "moteur";
  const byId = new Map(allCards.map((c) => [c.id, c]));
  const engine = config?.engine_card_id ? byId.get(config.engine_card_id) : undefined;
  const gearbox = config?.gearbox_card_id ? byId.get(config.gearbox_card_id) : undefined;
  const tire = config?.tire_card_id ? byId.get(config.tire_card_id) : undefined;
  const playable = Boolean(config && engine && gearbox && tire && alive.has(engine.id) && alive.has(gearbox.id) && alive.has(tire.id));

  const href = (over: Record<string, string>) => {
    const q = new URLSearchParams({ slot, ...over });
    if (page > 1) q.set("page", String(page));
    return `/duel?${q.toString()}`;
  };
  const alternatives = (cat: string, current?: string) => cards.filter((c) => c.card_templates.category === cat && c.id !== current);
  const otherModeCount = Number(Boolean(clm)) + Number(Boolean(dyno)) + Number(Boolean(configs));

  return (
    <>
      <PageHeader
        title="Jouer"
        description="Choisissez votre course, le reste est prêt."
        actions={
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
              playable
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-amber-500/30 bg-amber-500/10 text-amber-300"
            }`}
          >
            <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${playable ? "bg-emerald-400" : "bg-amber-400"}`} />
            {playable ? "Config prête" : "Config à compléter"}
          </span>
        }
      />

      <ConfigDisclosure defaultOpen={configParam === "1"} summary={<ConfigSummary engine={engine} gearbox={gearbox} tire={tire} />}>
        <ConfigBoard
          bare
          slot={slot}
          hrefFor={(s) => href({ slot: s })}
          engine={engine}
          gearbox={gearbox}
          tire={tire}
          alternatives={alternatives}
          deckId={config?.id}
          modifiers={modifiers}
        />
      </ConfigDisclosure>

      <section className="space-y-3">
        <SectionTitle title="Modes de jeu de base" />
        <div className="grid gap-3 lg:grid-cols-2">
          <DuelForm
            variant="hero"
            action={launchDuel}
            deckId={playable ? config?.id : undefined}
            bonuses={bonuses}
            tirePerfs={modifiers}
          >
            <SummaryPanel engine={engine} gearbox={gearbox} tire={tire} modifiers={modifiers} />
          </DuelForm>
          <ProposeDuel variant="hero" />
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle title="Défis quotidiens" />
        <DailyQuests state={quests} layout="detail" />
      </section>

      <details className="group overflow-hidden rounded-2xl border border-line bg-panel-deep">
        <summary className="flex cursor-pointer list-none items-center gap-3 p-4 transition hover:bg-panel [&::-webkit-details-marker]:hidden">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-300">
            <SlidersHorizontal size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="font-display text-base font-bold uppercase tracking-wide">Autres modes de jeu</span>
            <span className="mt-1.5 flex flex-wrap gap-1.5">
              <span className="rounded-full border border-white/[0.07] bg-white/[0.03] px-2 py-0.5 text-[10px] text-zinc-400">
                Contre-la-montre
              </span>
              <span className="rounded-full border border-white/[0.07] bg-white/[0.03] px-2 py-0.5 text-[10px] text-zinc-400">
                Banc d&apos;essai
              </span>
              <span className="rounded-full border border-white/[0.07] bg-white/[0.03] px-2 py-0.5 text-[10px] text-zinc-400">Config constructeur</span>
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="rounded-full border border-line bg-black/30 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-zinc-400">
              {otherModeCount}
            </span>
            <ChevronDown size={16} className="text-zinc-500 transition group-open:rotate-180" />
          </span>
        </summary>
        <div className="grid gap-3 border-t border-line p-3 sm:grid-cols-2 lg:grid-cols-3">
          {clm && (
            <ClmForm
              action={launchClm}
              deckId={playable ? config?.id : undefined}
              challenge={clm}
              bonuses={bonuses}
              tirePerfs={modifiers}
            />
          )}
          {dyno && (
            <DynoForm
              action={launchDyno}
              deckId={playable ? config?.id : undefined}
              challenge={dyno}
              engine={engine}
              gearbox={gearbox}
              tire={tire}
            />
          )}
          {configs && <ConfigConstructeurForm action={validateConfigPair} challenge={configs} />}
        </div>
      </details>

      <ReconditioningWorkshop available={{
        moteur: (workshopStock.moteur ?? 0) === 0,
        boite: (workshopStock.boite ?? 0) === 0,
        pneus: (workshopStock.pneus ?? 0) === 0,
      }} />

      {!playable && (
        <p className="text-sm text-zinc-500">
          Complétez Ma config avec un moteur, une boîte et des pneus disponibles.
        </p>
      )}

      {organized && (
        <ChallengeList
          incoming={organized.challenges.filter((c) => c.target_id === user.id).map((c) => ({ id: c.id, name: organized.names.get(c.challenger_id) ?? "?", at: c.created_at }))}
          outgoing={organized.challenges.filter((c) => c.challenger_id === user.id).map((c) => ({ id: c.id, name: organized.names.get(c.target_id) ?? "?", at: c.created_at }))}
        />
      )}

      <Suspense fallback={<DuelHistorySkeleton />}>
        <DuelHistory userId={user.id} page={page} slot={slot} />
      </Suspense>
    </>
  );
}
