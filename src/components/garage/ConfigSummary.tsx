import { Cog, Settings2 } from "lucide-react";
import { TireIcon } from "./icons";
import { TIRE_THEME } from "@/lib/format";
import { cardImageUrl } from "@/lib/card-images";
import type { SlotKey } from "./SlotTabs";
import type { UserCard } from "@/lib/types";

const META: Record<SlotKey, { label: string; text: string }> = {
  moteur: { label: "Moteur", text: "text-purple-400" },
  boite: { label: "Boîte", text: "text-blue-400" },
  pneus: { label: "Pneus", text: "text-emerald-400" },
};

/**
 * Résumé compact d'une configuration : trois emplacements côte à côte, sans
 * interaction. Sert d'en-tête au panneau « Ma config » de la page Jouer.
 */
export function ConfigSummary({
  engine,
  gearbox,
  tire,
}: {
  engine?: UserCard;
  gearbox?: UserCard;
  tire?: UserCard;
}) {
  const cards: Record<SlotKey, UserCard | undefined> = { moteur: engine, boite: gearbox, pneus: tire };

  return (
    <div className="grid grid-cols-3 gap-2">
      {(Object.keys(META) as SlotKey[]).map((slot) => {
        const card = cards[slot];
        const m = META[slot];
        const template = card?.card_templates;
        const img = template ? cardImageUrl(template) : null;
        const tireTheme = slot === "pneus" ? TIRE_THEME[template?.tire_type ?? ""] : undefined;
        const text = tireTheme?.text ?? m.text;
        const Icon = slot === "boite" ? Settings2 : Cog;
        const usable = Boolean(card && !card.is_destroyed && !card.is_listed);

        return (
          <div
            key={slot}
            className="relative flex min-w-0 flex-col gap-0.5 rounded-xl border border-line bg-panel px-2 py-2.5"
          >
            <span
              aria-hidden
              className={`absolute right-2 top-2 h-1.5 w-1.5 rounded-full ${
                usable ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" : "bg-zinc-600"
              }`}
            />
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img} alt="" className="h-8 w-12 object-contain mix-blend-lighten" />
            ) : slot === "pneus" ? (
              <TireIcon className="h-7 w-7" ring={tireTheme?.stroke} />
            ) : (
              <Icon size={24} strokeWidth={1.5} className={m.text} />
            )}
            <span className={`font-display text-[10px] font-semibold uppercase tracking-wide ${text}`}>{m.label}</span>
            <span className="w-full truncate font-display text-xs font-bold uppercase text-zinc-200">
              {template?.name.replace(/^Pneu /, "") ?? "Vide"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
