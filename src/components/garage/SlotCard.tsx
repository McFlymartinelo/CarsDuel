import Link from "next/link";
import { Cog, Disc, Settings2, type LucideIcon } from "lucide-react";
import { CardView, type TirePerf } from "@/components/CardView";
import { ChangeCardDialog } from "./ChangeCardDialog";
import { GaugeRing } from "./GaugeRing";
import { cardImageUrl } from "@/lib/card-images";
import { tireState } from "@/lib/game";
import type { UserCard } from "@/lib/types";

type Slot = "moteur" | "boite" | "pneus";

const SLOT_LABEL: Record<Slot, string> = { moteur: "Moteur", boite: "Boîte", pneus: "Pneus" };

// Silhouette et consigne de l'emplacement vide : dire quoi faire plutôt qu'afficher un cadre vide.
const EMPTY: Record<Slot, { icon: LucideIcon; title: string; none: string; href: string; cta: string }> = {
  moteur: { icon: Cog, title: "Choisissez votre moteur", none: "Aucun moteur disponible.", href: "/shop", cta: "Voir la boutique" },
  boite: { icon: Settings2, title: "Choisissez votre boîte", none: "Aucune boîte disponible.", href: "/shop", cta: "Voir la boutique" },
  pneus: { icon: Disc, title: "Chaussez votre voiture", none: "Aucun pneu disponible.", href: "/shop", cta: "Voir la boutique" },
};

export function SlotCard({
  slot,
  card,
  alternatives,
  deckId,
  tirePerfs = [],
}: {
  slot: Slot;
  card?: UserCard;
  alternatives: UserCard[];
  deckId?: string;
  tirePerfs?: TirePerf[];
}) {
  const change = (
    <ChangeCardDialog
      slot={slot}
      alternatives={alternatives.map((c) => ({ ...c, image: cardImageUrl(c.card_templates) }))}
      deckId={deckId}
      tirePerfs={tirePerfs}
    />
  );

  if (!card) {
    const e = EMPTY[slot];
    const available = alternatives.length;
    return (
      <div className="flex flex-col rounded-2xl border-2 border-dashed border-amber-500/40 bg-[#10131a] p-3">
        <span className="font-display text-sm uppercase tracking-wide text-zinc-300">{SLOT_LABEL[slot]}</span>
        <div className="my-3 flex min-h-72 flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-zinc-800 px-4 text-center">
          <e.icon aria-hidden strokeWidth={1} className="h-24 w-24 text-zinc-700" />
          <p className="font-display text-xl font-bold uppercase leading-tight text-zinc-200">{e.title}</p>
          {available > 0 ? (
            <p className="text-sm text-amber-300">{available} disponible{available > 1 ? "s" : ""} dans votre garage</p>
          ) : (
            <p className="text-sm text-zinc-500">
              {e.none}{" "}
              <Link href={e.href} className="text-amber-400 hover:underline">{e.cta}</Link>
            </p>
          )}
        </div>
        {change}
      </div>
    );
  }

  return (
    <CardView template={card.card_templates} card={card} image={cardImageUrl(card.card_templates)} tirePerfs={tirePerfs}>
      <div className="space-y-3">
        {slot === "pneus" && <GaugeRing percent={card.tire_wear ?? 0} state={tireState(card.tire_wear ?? 0)} />}
        {change}
      </div>
    </CardView>
  );
}
