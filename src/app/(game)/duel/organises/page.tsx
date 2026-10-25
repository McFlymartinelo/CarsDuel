import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ChallengeList, ProposeDuel } from "@/components/OrganizedDuels";
import { ConfigBoard } from "@/components/garage/ConfigBoard";
import { type SlotKey } from "@/components/garage/SlotTabs";
import { loadOrganizedPage } from "@/lib/queries";

export const metadata = { title: "Duels organisés — CarsDuel" };

const SLOTS: SlotKey[] = ["moteur", "boite", "pneus"];

export default async function OrganizedPage({ searchParams }: { searchParams: Promise<{ slot?: string }> }) {
  const { slot: slotParam } = await searchParams;
  const { user } = await requireUser();
  const loaded = await loadOrganizedPage(user.id).catch((e) => {
    console.error("duels organisés indisponibles :", e);
    return null;
  });
  if (!loaded) {
    return <p className="text-sm text-zinc-400">Les duels organisés ne sont pas encore disponibles.</p>;
  }
  const { cards: allCards, decks, modifiers, challenges, names } = loaded;
  const cards = allCards.filter((x) => !x.is_destroyed && !x.is_listed);
  const config = decks[0];
  const slot: SlotKey = SLOTS.includes(slotParam as SlotKey) ? (slotParam as SlotKey) : "moteur";
  const byId = new Map(allCards.map((c) => [c.id, c]));
  const engine = config ? byId.get(config.engine_card_id) : undefined;
  const gearbox = config ? byId.get(config.gearbox_card_id) : undefined;
  const tire = config ? byId.get(config.tire_card_id) : undefined;
  const alternatives = (cat: string, current?: string) => cards.filter((c) => c.card_templates.category === cat && c.id !== current);
  const incoming = challenges.filter((c) => c.target_id === user.id).map((c) => ({ id: c.id, name: names.get(c.challenger_id) ?? "?", at: c.created_at }));
  const outgoing = challenges.filter((c) => c.challenger_id === user.id).map((c) => ({ id: c.id, name: names.get(c.target_id) ?? "?", at: c.created_at }));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/duel" className="text-sm text-amber-400 hover:underline">Retour à Jouer</Link>
        <ProposeDuel />
      </div>
      <ConfigBoard
        slot={slot}
        hrefFor={(s) => `/duel/organises?slot=${s}`}
        engine={engine}
        gearbox={gearbox}
        tire={tire}
        alternatives={alternatives}
        deckId={config?.id}
        modifiers={modifiers}
      />
      <ChallengeList incoming={incoming} outgoing={outgoing} />
    </>
  );
}
