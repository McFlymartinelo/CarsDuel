import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { DailyQuests } from "@/components/DailyQuests";
import { DuelForm } from "@/components/DuelForm";
import { ChallengeList, ProposeDuel } from "@/components/OrganizedDuels";
import { ConfigBoard } from "@/components/garage/ConfigBoard";
import { SummaryPanel } from "@/components/garage/SummaryPanel";
import { type SlotKey } from "@/components/garage/SlotTabs";
import { WEATHER_LABEL, formatDateTime } from "@/lib/format";
import { cardImageUrl } from "@/lib/card-images";
import { DUEL_PAGE_SIZE, getDailyQuests, loadDuelPage, loadOrganizedPage } from "@/lib/queries";
import { launchDuel } from "./actions";

export const metadata = { title: "Jouer — CarsDuel" };

const SLOTS: SlotKey[] = ["moteur", "boite", "pneus"];

export default async function DuelPage({ searchParams }: { searchParams: Promise<{ page?: string; slot?: string }> }) {
  const { page: pageParam, slot: slotParam } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const { user } = await requireUser();
  const [{ cards: allCards, decks: allDecks, modifiers, history, names: nameOf }, quests, organized] = await Promise.all([
    loadDuelPage(user.id, page),
    getDailyQuests(user.id).catch((e) => {
      console.error("défis indisponibles :", e);
      return null;
    }),
    loadOrganizedPage(user.id).catch((e) => {
      console.error("demandes de duel indisponibles :", e);
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
  const engine = config ? byId.get(config.engine_card_id) : undefined;
  const gearbox = config ? byId.get(config.gearbox_card_id) : undefined;
  const tire = config ? byId.get(config.tire_card_id) : undefined;
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

      <div className="grid gap-3 md:grid-cols-3">
        <DuelForm action={launchDuel} deckId={playable ? config?.id : undefined} bonuses={bonuses} tirePerfs={modifiers}>
          <SummaryPanel engine={engine} gearbox={gearbox} tire={tire} modifiers={modifiers} />
        </DuelForm>
        <ProposeDuel />
        <DailyQuests state={quests} />
      </div>
      {!playable && <p className="text-sm text-zinc-500">Complétez Ma config avec un moteur, une boîte et des pneus disponibles.</p>}

      {organized && <ChallengeList
        incoming={organized.challenges.filter((c) => c.target_id === user.id).map((c) => ({ id: c.id, name: organized.names.get(c.challenger_id) ?? "?", at: c.created_at }))}
        outgoing={organized.challenges.filter((c) => c.challenger_id === user.id).map((c) => ({ id: c.id, name: organized.names.get(c.target_id) ?? "?", at: c.created_at }))}
      />}

      <section className="space-y-5">
        <h2 className="text-xl font-bold">Historique des duels</h2>
        <div className="space-y-3">
        <div className="space-y-2 md:hidden">
          {history.map((x) => {
            const attacker = x.attacker_id === user.id;
            const won = attacker ? x.result === "attacker_win" : x.result === "defender_win";
            const coins = attacker ? x.attacker_coins : x.defender_coins;
            const xp = attacker ? x.attacker_xp : x.defender_xp;
            return (
              <div key={x.id} className="rounded-lg border border-zinc-800 bg-[#10131a] p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className={`font-display text-base font-bold uppercase ${won ? "text-emerald-400" : "text-red-400"}`}>{won ? "Victoire" : "Défaite"}</span>
                  <span className="text-xs text-zinc-500">{formatDateTime(x.created_at)}</span>
                </div>
                <p className="text-zinc-300">{attacker ? "Attaque" : "Défense"} vs {nameOf.get(attacker ? x.defender_id : x.attacker_id) ?? "?"} · {WEATHER_LABEL[x.weather]}</p>
                <p className="text-amber-300">{attacker || x.defender_rewarded ? `+${coins} 🪙 · +${xp} XP` : "Plafond de défenses atteint"}</p>
              </div>
            );
          })}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="text-zinc-500">
              <tr><th className="py-1">Date</th><th>Rôle</th><th>Adversaire</th><th>Météo</th><th>Résultat</th><th>Gains</th></tr>
            </thead>
            <tbody>
              {history.map((x) => {
                const attacker = x.attacker_id === user.id;
                const won = attacker ? x.result === "attacker_win" : x.result === "defender_win";
                const coins = attacker ? x.attacker_coins : x.defender_coins;
                const xp = attacker ? x.attacker_xp : x.defender_xp;
                return (
                  <tr key={x.id} className="border-t border-zinc-800">
                    <td className="py-1.5">{formatDateTime(x.created_at)}</td>
                    <td>{attacker ? "Attaque" : "Défense"}</td>
                    <td>{nameOf.get(attacker ? x.defender_id : x.attacker_id) ?? "?"}</td>
                    <td>{WEATHER_LABEL[x.weather]}</td>
                    <td className={won ? "text-emerald-400" : "text-red-400"}>{won ? "Victoire" : "Défaite"}</td>
                    <td>{attacker || x.defender_rewarded ? `+${coins} 🪙 +${xp} XP` : "— (plafond atteint)"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {history.length === 0 && <p className="text-sm text-zinc-500">Aucun duel pour l&apos;instant.</p>}
        <div className="flex gap-4 text-sm">
          {page > 1 && <Link href={pageHref(page - 1)} className="text-amber-400 hover:underline">Page précédente</Link>}
          {history.length === DUEL_PAGE_SIZE && <Link href={pageHref(page + 1)} className="text-amber-400 hover:underline">Voir plus</Link>}
        </div>
        </div>
      </section>
    </>
  );
}
