import { SlotCard } from "@/components/garage/SlotCard";
import { SlotTabs, type SlotKey } from "@/components/garage/SlotTabs";
import { SummaryPanel } from "@/components/garage/SummaryPanel";
import type { TireModifier } from "@/lib/queries";
import type { UserCard } from "@/lib/types";

/** Moteur, boîte, pneus et résumé. Partagé par Jouer et les duels organisés. */
export function ConfigBoard({
  slot,
  hrefFor,
  engine,
  gearbox,
  tire,
  alternatives,
  deckId,
  modifiers,
}: {
  slot: SlotKey;
  hrefFor: (slot: SlotKey) => string;
  engine?: UserCard;
  gearbox?: UserCard;
  tire?: UserCard;
  alternatives: (cat: string, current?: string) => UserCard[];
  deckId?: string;
  modifiers: TireModifier[];
}) {
  const slotWrap = (key: SlotKey) => (key === slot ? "" : "hidden md:block");
  return (
    <section className="space-y-3">
      <h1 className="font-display text-3xl font-bold uppercase">Ma config</h1>
      <p className="text-sm text-zinc-400">Choisissez le moteur, la boîte et les pneus de la course.</p>
      <SlotTabs current={slot} cards={{ moteur: engine, boite: gearbox, pneus: tire }} hrefFor={hrefFor} />
      <div className="space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 xl:grid-cols-[1fr_1fr_1fr_1.1fr]">
        <div className={slotWrap("moteur")}>
          <SlotCard slot="moteur" card={engine} alternatives={alternatives("moteur", engine?.id)} deckId={deckId} tirePerfs={modifiers} />
        </div>
        <div className={slotWrap("boite")}>
          <SlotCard slot="boite" card={gearbox} alternatives={alternatives("boite", gearbox?.id)} deckId={deckId} tirePerfs={modifiers} />
        </div>
        <div className={slotWrap("pneus")}>
          <SlotCard slot="pneus" card={tire} alternatives={alternatives("pneus", tire?.id)} deckId={deckId} tirePerfs={modifiers} />
        </div>
        <SummaryPanel engine={engine} gearbox={gearbox} tire={tire} modifiers={modifiers} />
      </div>
      {engine?.is_destroyed && (
        <p className="rounded-lg border border-red-700 bg-red-950/40 p-3 text-sm text-red-300">Moteur cassé. Recyclage possible pour 1 pièce, dans le garage.</p>
      )}
      {gearbox?.is_destroyed && (
        <p className="rounded-lg border border-red-700 bg-red-950/40 p-3 text-sm text-red-300">Boîte cassée. Recyclage possible pour 1 pièce, dans le garage.</p>
      )}
      {tire?.is_destroyed && (
        <p className="rounded-lg border border-red-700 bg-red-950/40 p-3 text-sm text-red-300">Pneu mort : changez-le avant de rouler. Recyclage possible pour 1 pièce, dans le garage.</p>
      )}
    </section>
  );
}
