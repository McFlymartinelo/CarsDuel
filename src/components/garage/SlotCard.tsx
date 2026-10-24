import { ActionForm } from "@/components/ActionForm";
import { CardView, type TirePerf } from "@/components/CardView";
import { GaugeRing } from "./GaugeRing";
import { cardSummary } from "@/lib/format";
import { tireState } from "@/lib/game";
import type { UserCard } from "@/lib/types";
import { equipCard } from "@/app/(game)/garage/actions";

type Slot = "moteur" | "boite" | "pneus";

const SLOT_LABEL: Record<Slot, string> = { moteur: "Moteur", boite: "Boîte", pneus: "Pneus" };

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
    <details className="[&_summary::-webkit-details-marker]:hidden">
      <summary className="cursor-pointer list-none rounded border border-white/30 bg-black/40 py-1.5 text-center text-sm font-medium text-zinc-100 hover:bg-white/10">
        {slot === "pneus" ? "Changer / Réparer" : "Changer"}
      </summary>
      <div className="mt-2 max-h-56 space-y-2 overflow-y-auto">
        {alternatives.length === 0 && <p className="text-xs text-zinc-500">Aucune autre carte disponible.</p>}
        {alternatives.map((alt) => (
          <div key={alt.id} className="rounded border border-zinc-800 bg-black/40 p-2">
            <p className="text-sm font-medium">{alt.card_templates.name}</p>
            <p className="mb-1 text-xs text-zinc-500">{cardSummary(alt.card_templates, alt)}</p>
            <ActionForm action={equipCard} submitLabel="Équiper" variant="outline" className="flex">
              <input type="hidden" name="card_id" value={alt.id} />
              {deckId && <input type="hidden" name="deck_id" value={deckId} />}
            </ActionForm>
          </div>
        ))}
      </div>
    </details>
  );

  if (!card) {
    return (
      <div className="flex flex-col rounded-2xl border-2 border-dashed border-zinc-700 bg-[#10131a] p-3">
        <span className="font-display text-sm uppercase tracking-wide text-zinc-300">{SLOT_LABEL[slot]}</span>
        <div className="my-3 flex min-h-72 flex-1 items-center justify-center rounded-lg border border-dashed border-zinc-800 text-sm text-zinc-500">
          Emplacement vide
        </div>
        {change}
      </div>
    );
  }

  return (
    <CardView template={card.card_templates} card={card} tirePerfs={tirePerfs}>
      <div className="space-y-3">
        {slot === "pneus" && <GaugeRing percent={card.tire_wear ?? 0} state={tireState(card.tire_wear ?? 0)} />}
        {change}
      </div>
    </CardView>
  );
}
