import Link from "next/link";
import { Coins, Swords } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { DailyQuests } from "@/components/DailyQuests";
import { DuelForm } from "@/components/DuelForm";
import { ClmForm } from "@/components/ClmForm";
import { DynoForm } from "@/components/DynoForm";
import { ConfigConstructeurForm } from "@/components/ConfigConstructeurForm";
import { ChallengeList, ProposeDuel } from "@/components/OrganizedDuels";
import { ConfigBoard } from "@/components/garage/ConfigBoard";
import { SummaryPanel } from "@/components/garage/SummaryPanel";
import { type SlotKey } from "@/components/garage/SlotTabs";
import { WEATHER_LABEL, formatDateTime } from "@/lib/format";
import { cardImageUrl } from "@/lib/card-images";
import { parsePage } from "@/lib/pagination";
import { DUEL_PAGE_SIZE, getDailyQuests, loadClmChallenge, loadConfigChallenge, loadDuelPage, loadDynoChallenge, loadOrganizedChallenges } from "@/lib/queries";
import { launchClm, launchDuel, launchDyno, validateConfigPair } from "./actions";

export const metadata = { title: "Jouer — CarsDuel" };

const SLOTS: SlotKey[] = ["moteur", "boite", "pneus"];

export default async function DuelPage({ searchParams }: { searchParams: Promise<{ page?: string; slot?: string }> }) {
  const { page: pageParam, slot: slotParam } = await searchParams;
  const page = parsePage(pageParam);
  const nextPage = parsePage(page + 1);
  const { user } = await requireUser();
  const [{ cards: allCards, decks: allDecks, modifiers, history, names: nameOf }, quests, organized, clm, dyno, configs] = await Promise.all([
    loadDuelPage(user.id, page),
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
  const pageHref = (n: number) => {
    const q = new URLSearchParams({ slot });
    if (n > 1) q.set("page", String(n));
    return `/duel?${q.toString()}`;
  };
  const alternatives = (cat: string, current?: string) => cards.filter((c) => c.card_templates.category === cat && c.id !== current);

  return (
    <>
      <ConfigBoard
        slot={slot}
        hrefFor={(s) => href({ slot: s })}
        engine={engine}
        gearbox={gearbox}
        tire={tire}
        alternatives={alternatives}
        deckId={config?.id}
        modifiers={modifiers}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <DailyQuests state={quests} />
        <DuelForm action={launchDuel} deckId={playable ? config?.id : undefined} bonuses={bonuses} tirePerfs={modifiers}>
          <SummaryPanel engine={engine} gearbox={gearbox} tire={tire} modifiers={modifiers} />
        </DuelForm>
        <ProposeDuel />
        {clm && (
          <ClmForm
            action={launchClm}
            deckId={playable ? config?.id : undefined}
            challenge={clm}
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
      {!playable && <p className="text-sm text-zinc-500">Complétez Ma config avec un moteur, une boîte et des pneus disponibles.</p>}

      {organized && <ChallengeList
        incoming={organized.challenges.filter((c) => c.target_id === user.id).map((c) => ({ id: c.id, name: organized.names.get(c.challenger_id) ?? "?", at: c.created_at }))}
        outgoing={organized.challenges.filter((c) => c.challenger_id === user.id).map((c) => ({ id: c.id, name: organized.names.get(c.target_id) ?? "?", at: c.created_at }))}
      />}

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 font-display text-xl font-bold uppercase">
              <Swords size={18} className="text-amber-400" aria-hidden />
              Historique des duels
            </h2>
            <p className="mt-1 text-sm text-zinc-400">Vos dernières courses, en attaque comme en défense.</p>
          </div>
          {history.length > 0 && (
            <span className="rounded-full border border-zinc-700 bg-[#10131a] px-3 py-1 text-xs font-semibold text-zinc-300">
              {history.length} duel{history.length > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {history.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-zinc-700 bg-[#0e1117] px-4 py-10 text-center">
            <Swords size={26} className="text-amber-400/60" aria-hidden />
            <p className="text-sm text-zinc-400">Aucun duel pour l&apos;instant.</p>
            <p className="text-xs text-zinc-500">Lancez votre première course depuis Ma config.</p>
          </div>
        ) : (
          <>
            <div className="space-y-2 md:hidden">
              {history.map((x) => {
                const attacker = x.attacker_id === user.id;
                const won = attacker ? x.result === "attacker_win" : x.result === "defender_win";
                const coins = attacker ? x.attacker_coins : x.defender_coins;
                const xp = attacker ? x.attacker_xp : x.defender_xp;
                return (
                  <div
                    key={x.id}
                    className={`rounded-xl border border-zinc-800 border-l-2 bg-[#10131a] p-3 ${won ? "border-l-emerald-400" : "border-l-red-500"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`rounded-md px-2 py-0.5 font-display text-[11px] font-bold uppercase tracking-wide ${
                          won ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"
                        }`}
                      >
                        {won ? "Victoire" : "Défaite"}
                      </span>
                      <span className="text-[11px] text-zinc-500">{formatDateTime(x.created_at)}</span>
                    </div>
                    <p className="mt-2 text-sm text-zinc-200">
                      <span className="text-zinc-500">{attacker ? "Attaque vs" : "Défense vs"}</span>{" "}
                      <span className="font-semibold">{nameOf.get(attacker ? x.defender_id : x.attacker_id) ?? "?"}</span>
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="rounded border border-zinc-700/70 px-1.5 py-0.5 text-zinc-400">{WEATHER_LABEL[x.weather]}</span>
                      {attacker || x.defender_rewarded ? (
                        <span className="inline-flex items-center gap-1 text-amber-300">
                          <Coins size={12} aria-hidden />
                          {coins} pièces · {xp} XP
                        </span>
                      ) : (
                        <span className="text-zinc-500">Plafond de défenses atteint</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto rounded-xl border border-zinc-800 md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-900/70 font-display text-[11px] uppercase tracking-wider text-zinc-400">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Date</th>
                    <th className="px-3 py-2 font-semibold">Rôle</th>
                    <th className="px-3 py-2 font-semibold">Adversaire</th>
                    <th className="px-3 py-2 font-semibold">Météo</th>
                    <th className="px-3 py-2 font-semibold">Résultat</th>
                    <th className="px-3 py-2 font-semibold">Gains</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {history.map((x) => {
                    const attacker = x.attacker_id === user.id;
                    const won = attacker ? x.result === "attacker_win" : x.result === "defender_win";
                    const coins = attacker ? x.attacker_coins : x.defender_coins;
                    const xp = attacker ? x.attacker_xp : x.defender_xp;
                    return (
                      <tr key={x.id} className="transition-colors hover:bg-white/[0.03]">
                        <td className="px-3 py-2 text-zinc-400">{formatDateTime(x.created_at)}</td>
                        <td className="px-3 py-2 text-zinc-300">{attacker ? "Attaque" : "Défense"}</td>
                        <td className="px-3 py-2 font-medium text-zinc-200">{nameOf.get(attacker ? x.defender_id : x.attacker_id) ?? "?"}</td>
                        <td className="px-3 py-2 text-zinc-400">{WEATHER_LABEL[x.weather]}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                              won ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"
                            }`}
                          >
                            {won ? "Victoire" : "Défaite"}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {attacker || x.defender_rewarded ? (
                            <span className="inline-flex items-center gap-1 text-amber-300">
                              <Coins size={13} aria-hidden />
                              {coins} · {xp} XP
                            </span>
                          ) : (
                            <span className="text-zinc-500">— plafond atteint</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="flex flex-wrap gap-3 text-sm">
          {page > 1 && (
            <Link href={pageHref(page - 1)} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-zinc-300 transition-colors hover:border-amber-400/50 hover:text-amber-300">
              ← Page précédente
            </Link>
          )}
          {history.length === DUEL_PAGE_SIZE && nextPage > page && (
            <Link href={pageHref(nextPage)} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-zinc-300 transition-colors hover:border-amber-400/50 hover:text-amber-300">
              Voir plus →
            </Link>
          )}
        </div>
      </section>
    </>
  );
}
