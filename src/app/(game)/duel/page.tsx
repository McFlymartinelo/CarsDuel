import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { DuelForm } from "@/components/DuelForm";
import { SlotCard } from "@/components/garage/SlotCard";
import { SlotTabs, type SlotKey } from "@/components/garage/SlotTabs";
import { SummaryPanel } from "@/components/garage/SummaryPanel";
import { WEATHER_LABEL, formatDateTime } from "@/lib/format";
import { DUEL_PAGE_SIZE, loadDuelPage } from "@/lib/queries";
import { launchDuel } from "./actions";

export const metadata = { title: "Duel — CarsDuel" };

const SLOTS: SlotKey[] = ["moteur", "boite", "pneus"];

export default async function DuelPage({ searchParams }: { searchParams: Promise<{ bonus?: string; page?: string; slot?: string }> }) {
  const { bonus: bonusParam, page: pageParam, slot: slotParam } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const { user } = await requireUser();
  const { cards: allCards, decks: allDecks, modifiers, history, suffered, attacks, names: nameOf } = await loadDuelPage(user.id, page);
  const cards = allCards.filter((x) => !x.is_destroyed && !x.is_listed);
  const alive = new Set(cards.map((x) => x.id));
  const config = allDecks[0];
  const bonuses = cards.filter((x) => x.card_templates.category === "bonus");
  const slot: SlotKey = SLOTS.includes(slotParam as SlotKey) ? (slotParam as SlotKey) : "moteur";
  const byId = new Map(allCards.map((c) => [c.id, c]));
  const engine = config ? byId.get(config.engine_card_id) : undefined;
  const gearbox = config ? byId.get(config.gearbox_card_id) : undefined;
  const tire = config ? byId.get(config.tire_card_id) : undefined;
  const playable = Boolean(
    config && engine && gearbox && tire
      && alive.has(engine.id) && alive.has(gearbox.id) && alive.has(tire.id),
  );

  const href = (over: Record<string, string>) => {
    const q = new URLSearchParams({ slot, ...over });
    if (bonusParam) q.set("bonus", bonusParam);
    if (page > 1) q.set("page", String(page));
    return `/duel?${q.toString()}`;
  };
  const pageHref = (n: number) => {
    const q = new URLSearchParams({ slot });
    if (bonusParam) q.set("bonus", bonusParam);
    if (n > 1) q.set("page", String(n));
    return `/duel?${q.toString()}`;
  };

  const alternatives = (cat: string, current?: string) =>
    cards.filter((c) => c.card_templates.category === cat && c.id !== current);
  const slotWrap = (key: SlotKey) => (key === slot ? "" : "hidden md:block");

  return (
    <>
      <section className="space-y-3">
        <h1 className="font-display text-3xl font-bold uppercase">Ma config</h1>
        <p className="text-sm text-zinc-400">Choisissez le moteur, la boîte et les pneus de la course. Le garage ne garde que l&apos;inventaire.</p>
        <SlotTabs current={slot} cards={{ moteur: engine, boite: gearbox, pneus: tire }} hrefFor={(s) => href({ slot: s })} />
        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 xl:grid-cols-[1fr_1fr_1fr_1.1fr]">
          <div className={slotWrap("moteur")}>
            <SlotCard slot="moteur" card={engine} alternatives={alternatives("moteur", engine?.id)} deckId={config?.id} tirePerfs={modifiers} />
          </div>
          <div className={slotWrap("boite")}>
            <SlotCard slot="boite" card={gearbox} alternatives={alternatives("boite", gearbox?.id)} deckId={config?.id} tirePerfs={modifiers} />
          </div>
          <div className={slotWrap("pneus")}>
            <SlotCard slot="pneus" card={tire} alternatives={alternatives("pneus", tire?.id)} deckId={config?.id} tirePerfs={modifiers} />
          </div>
          <SummaryPanel engine={engine} gearbox={gearbox} tire={tire} modifiers={modifiers} />
        </div>
        {tire?.is_destroyed && (
          <p className="rounded-lg border border-red-700 bg-red-950/40 p-3 text-sm text-red-300">
            Pneu détruit : changez-le avant de rouler.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="hidden font-display text-3xl font-bold uppercase md:block">Duel contre un fantôme</h2>
        <p className="hidden text-sm text-zinc-400 md:block">Un fantôme de niveau proche est tiré. Le résultat est calculé côté serveur.</p>
        <p className="text-sm text-amber-300">
          Attaques restantes aujourd&apos;hui : {attacks.remaining} / {attacks.cap} (reset à minuit, heure de Paris).
        </p>
        <DuelForm
          action={launchDuel}
          deckId={playable ? config?.id : undefined}
          bonuses={bonuses.map((x) => ({ id: x.id, label: x.card_templates.name }))}
          defaultBonus={bonuses.find((x) => x.id === bonusParam)?.id}
        />
        {!playable && <p className="text-sm text-zinc-500">Complétez Ma config avec un moteur, une boîte et des pneus disponibles.</p>}
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
        <div className="flex gap-4 text-sm">
          {page > 1 && <Link href={pageHref(page - 1)} className="text-amber-400 hover:underline">Page précédente</Link>}
          {history.length === DUEL_PAGE_SIZE && <Link href={pageHref(page + 1)} className="text-amber-400 hover:underline">Voir plus</Link>}
        </div>
      </section>
    </>
  );
}
