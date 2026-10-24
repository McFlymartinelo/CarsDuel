import { requireUser } from "@/lib/auth";
import { DuelForm } from "@/components/DuelForm";
import { WEATHER_LABEL, formatDateTime } from "@/lib/format";
import { getAttackStatus, getDuelHistory, getOwnCards, getOwnDecks, getSufferedDuels, getUsernames } from "@/lib/queries";
import { launchDuel } from "./actions";

export const metadata = { title: "Duel — CarsDuel" };

export default async function DuelPage({ searchParams }: { searchParams: Promise<{ deck?: string; bonus?: string }> }) {
  const { deck: deckParam, bonus: bonusParam } = await searchParams;
  const { user } = await requireUser();
  const [allCards, allDecks, history, suffered, attacks] = await Promise.all([
    getOwnCards(user.id), getOwnDecks(user.id), getDuelHistory(user.id),
    getSufferedDuels(user.id), getAttackStatus(user.id),
  ]);
  const cards = allCards.filter((x) => !x.is_destroyed && !x.is_listed);
  const alive = new Set(cards.map((x) => x.id));
  const decks = allDecks.filter(
    (x) => alive.has(x.engine_card_id) && alive.has(x.gearbox_card_id) && alive.has(x.tire_card_id),
  );
  const bonuses = cards.filter((x) => x.card_templates.category === "bonus");

  const otherIds = [...new Set([
    ...history.map((x) => (x.attacker_id === user.id ? x.defender_id : x.attacker_id)),
    ...suffered.map((x) => x.attacker_id),
  ])];
  const nameOf = await getUsernames(user.id, otherIds);

  return (
    <>
      <section className="space-y-3">
        <h1 className="hidden font-display text-3xl font-bold uppercase md:block">Duel contre un fantôme</h1>
        <p className="hidden text-sm text-zinc-400 md:block">Un fantôme de niveau proche est tiré. Le résultat est calculé côté serveur.</p>
        <p className="text-sm text-amber-300">
          Attaques restantes aujourd&apos;hui : {attacks.remaining} / {attacks.cap} (reset à minuit, heure de Paris).
        </p>
        <DuelForm
          action={launchDuel}
          decks={decks.map((x) => ({ id: x.id, label: x.name }))}
          bonuses={bonuses.map((x) => ({ id: x.id, label: x.card_templates.name }))}
          defaultDeck={decks.find((x) => x.id === deckParam)?.id ?? decks[0]?.id}
          defaultBonus={bonuses.find((x) => x.id === bonusParam)?.id}
        />
        {decks.length === 0 && <p className="text-sm text-zinc-500">Aucun deck jouable (cartes détruites, en vente, ou deck non créé).</p>}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Duels subis récemment</h2>
        {suffered.length === 0 && <p className="text-sm text-zinc-500">Personne ne vous a encore attaqué.</p>}
        <ul className="space-y-2">
          {suffered.map((x) => {
            const won = x.result === "defender_win";
            return (
              <li key={x.id} className="rounded-lg border border-zinc-800 bg-[#10131a] p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-zinc-300">Attaquant : {nameOf.get(x.attacker_id) ?? "?"}</span>
                  <span className={`font-display font-bold uppercase ${won ? "text-emerald-400" : "text-red-400"}`}>
                    {won ? "Victoire" : "Défaite"}
                  </span>
                </div>
                <p className="text-amber-300">
                  {x.defender_rewarded ? `+${x.defender_coins} 🪙 · +${x.defender_xp} XP` : "Plafond de défenses atteint"}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Historique</h2>
        <div className="space-y-2 md:hidden">
          {history.map((x) => {
            const attacker = x.attacker_id === user.id;
            const won = attacker ? x.result === "attacker_win" : x.result === "defender_win";
            const coins = attacker ? x.attacker_coins : x.defender_coins;
            const xp = attacker ? x.attacker_xp : x.defender_xp;
            return (
              <div key={x.id} className="rounded-lg border border-zinc-800 bg-[#10131a] p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className={`font-display text-base font-bold uppercase ${won ? "text-emerald-400" : "text-red-400"}`}>
                    {won ? "Victoire" : "Défaite"}
                  </span>
                  <span className="text-xs text-zinc-500">{formatDateTime(x.created_at)}</span>
                </div>
                <p className="text-zinc-300">
                  {attacker ? "Attaque" : "Défense"} vs {nameOf.get(attacker ? x.defender_id : x.attacker_id) ?? "?"} · {WEATHER_LABEL[x.weather]}
                </p>
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
      </section>
    </>
  );
}
