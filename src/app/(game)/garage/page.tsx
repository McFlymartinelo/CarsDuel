import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ActionForm } from "@/components/ActionForm";
import { SlotCard } from "@/components/garage/SlotCard";
import { SlotTabs, type SlotKey } from "@/components/garage/SlotTabs";
import { SummaryPanel } from "@/components/garage/SummaryPanel";
import { Inventory } from "@/components/garage/Inventory";
import { parisToday } from "@/lib/format";
import { getOwnCards, getOwnDecks, getProfile, getTireModifiers } from "@/lib/queries";
import { claimDailyPull, createDeck, deleteDeck } from "./actions";

export const metadata = { title: "Garage — CarsDuel" };

const SLOTS: SlotKey[] = ["moteur", "boite", "pneus"];

export default async function GaragePage({
  searchParams,
}: {
  searchParams: Promise<{ deck?: string; tab?: string; slot?: string }>;
}) {
  const { deck: deckParam, tab = "pneus", slot: slotParam } = await searchParams;
  const { user } = await requireUser();
  const [profile, cards, decks, modifiers] = await Promise.all([
    getProfile(user.id), getOwnCards(user.id), getOwnDecks(user.id), getTireModifiers(user.id),
  ]);
  if (!profile) return null;

  const active = decks.find((d) => d.id === deckParam) ?? decks[0];
  const slot: SlotKey = SLOTS.includes(slotParam as SlotKey) ? (slotParam as SlotKey) : "moteur";
  const byId = new Map(cards.map((c) => [c.id, c]));
  const engine = active && byId.get(active.engine_card_id);
  const gearbox = active && byId.get(active.gearbox_card_id);
  const tire = active && byId.get(active.tire_card_id);

  // Liens internes : on conserve deck / emplacement / onglet d'inventaire d'un lien à l'autre.
  const href = (over: Record<string, string>) => {
    const q = new URLSearchParams({ ...(active ? { deck: active.id } : {}), slot, tab, ...over });
    return `/garage?${q.toString()}`;
  };

  const usable = cards.filter((c) => !c.is_destroyed && !c.is_listed);
  const alternatives = (cat: string, current?: string) =>
    usable.filter((c) => c.card_templates.category === cat && c.id !== current);
  const equippedHere = new Set(active ? [active.engine_card_id, active.gearbox_card_id, active.tire_card_id] : []);
  const inAnyDeck = new Set(decks.flatMap((d) => [d.engine_card_id, d.gearbox_card_id, d.tire_card_id]));
  const reserve = cards.filter((c) => !c.is_destroyed && !equippedHere.has(c.id));
  const claimed = profile.last_daily_pull === parisToday();

  const cta = (extra: string) =>
    active ? (
      <Link href={`/duel?deck=${active.id}`} className={`rounded-lg bg-amber-500 px-8 py-3 text-center font-display text-lg font-bold uppercase text-black hover:bg-amber-400 ${extra}`}>
        Lancer un duel
      </Link>
    ) : (
      <span className={`rounded-lg bg-zinc-800 px-8 py-3 text-center font-display text-lg font-bold uppercase text-zinc-500 ${extra}`}>
        Lancer un duel
      </span>
    );

  const slotWrap = (key: SlotKey) => (key === slot ? "" : "hidden md:block");

  return (
    <>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
        <div>
          <h1 className="hidden font-display text-3xl font-bold uppercase md:block">
            Garage principal <span className="text-amber-500">&gt;</span> Configuration du deck actif
          </h1>
          <p className="hidden text-zinc-400 md:block">Préparez votre trio moteur, boîte et pneus pour le prochain run asynchrone.</p>
          {decks.length > 1 && (
            <div className="flex flex-wrap gap-1 md:mt-2">
              {decks.map((d) => (
                <Link
                  key={d.id}
                  href={href({ deck: d.id })}
                  className={`rounded-md px-3 py-1 text-sm ${d.id === active?.id ? "bg-zinc-700 text-white" : "border border-zinc-700 text-zinc-400 hover:text-white"}`}
                >
                  {d.name}
                </Link>
              ))}
            </div>
          )}
        </div>
        {cta("hidden md:block")}
      </div>

      <SlotTabs current={slot} cards={{ moteur: engine, boite: gearbox, pneus: tire }} hrefFor={(s) => href({ slot: s })} />

      <div className="space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 xl:grid-cols-[1fr_1fr_1fr_1.1fr]">
        <div className={slotWrap("moteur")}>
          <SlotCard slot="moteur" card={engine} alternatives={alternatives("moteur", engine?.id)} deckId={active?.id} tirePerfs={modifiers} />
        </div>
        <div className={slotWrap("boite")}>
          <SlotCard slot="boite" card={gearbox} alternatives={alternatives("boite", gearbox?.id)} deckId={active?.id} tirePerfs={modifiers} />
        </div>
        <div className={slotWrap("pneus")}>
          <SlotCard slot="pneus" card={tire} alternatives={alternatives("pneus", tire?.id)} deckId={active?.id} tirePerfs={modifiers} />
        </div>
        <SummaryPanel engine={engine} gearbox={gearbox} tire={tire} modifiers={modifiers} />
      </div>

      {cta("block md:hidden")}

      {tire?.is_destroyed && (
        <p className="rounded-lg border border-red-700 bg-red-950/40 p-3 text-sm text-red-300">
          Pneu détruit : le deck est bloqué tant qu&apos;un nouveau pneu n&apos;est pas équipé.
        </p>
      )}

      <div className="grid items-start gap-6 2xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Inventory cards={reserve} tab={tab} deckId={active?.id} inAnyDeck={inAnyDeck} hrefForTab={(t) => href({ tab: t })} tirePerfs={modifiers} />

        <div className="space-y-6">
          <section id="tirage" className="scroll-mt-28 space-y-3">
            <h2 className="font-display text-2xl font-bold uppercase">Tirage quotidien</h2>
            {claimed ? (
              <p className="text-sm text-zinc-400">Déjà effectué aujourd&apos;hui. Prochain tirage à minuit (heure de Paris).</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-1">
                <div className="rounded-xl border border-zinc-800 bg-[#0e1117] p-4">
                  <h3 className="font-semibold">Option 1 — Mécanique</h3>
                  <p className="mb-3 text-sm text-zinc-400">1 moteur ou boîte (raretés 70 / 20 / 7 / 2,5 / 0,5 %) + 1 bonus.</p>
                  <ActionForm action={claimDailyPull} submitLabel="Tirer">
                    <input type="hidden" name="option" value="1" />
                  </ActionForm>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-[#0e1117] p-4">
                  <h3 className="font-semibold">Option 2 — Consommables</h3>
                  <p className="mb-3 text-sm text-zinc-400">5 cartes bonus.</p>
                  <ActionForm action={claimDailyPull} submitLabel="Tirer" variant="ghost">
                    <input type="hidden" name="option" value="2" />
                  </ActionForm>
                </div>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl font-bold uppercase">Mes decks</h2>
            <div className="flex flex-wrap gap-2">
              {decks.map((d) => (
                <div key={d.id} className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-[#0e1117] px-3 py-1.5">
                  <span className="text-sm">{d.name}</span>
                  <ActionForm action={deleteDeck} submitLabel="Supprimer" variant="outlineDanger" confirmText="Supprimer ce deck ?" className="flex">
                    <input type="hidden" name="deck_id" value={d.id} />
                  </ActionForm>
                </div>
              ))}
            </div>
            <details className="rounded-xl border border-zinc-800 bg-[#0e1117] p-4">
              <summary className="cursor-pointer font-medium">Nouveau deck</summary>
              <ActionForm action={createDeck} submitLabel="Créer" className="mt-3 flex flex-col gap-2 sm:max-w-md">
                <input name="name" type="text" placeholder="Nom du deck" maxLength={40} />
                {(
                  [["engine", "moteur", "Moteur"], ["gearbox", "boite", "Boîte"], ["tire", "pneus", "Pneus"]] as const
                ).map(([field, cat, label]) => (
                  <select key={field} name={field} required defaultValue="">
                    <option value="" disabled>{label}…</option>
                    {usable.filter((x) => x.card_templates.category === cat).map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.card_templates.name}{cat === "pneus" ? ` (${x.tire_wear}%)` : ` (${x.runs_count} runs)`}
                      </option>
                    ))}
                  </select>
                ))}
              </ActionForm>
            </details>
          </section>
        </div>
      </div>
    </>
  );
}
