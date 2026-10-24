import Link from "next/link";
import { Cog, Settings2 } from "lucide-react";
import { TireIcon } from "./icons";
import { TIRE_THEME } from "@/lib/format";
import type { UserCard } from "@/lib/types";
import { cardImageUrl } from "@/lib/card-images";

export type SlotKey = "moteur" | "boite" | "pneus";

const META: Record<SlotKey, { label: string; text: string; active: string }> = {
  moteur: { label: "Moteur", text: "text-purple-400", active: "border-purple-500" },
  boite: { label: "Boîte", text: "text-blue-400", active: "border-blue-500" },
  pneus: { label: "Pneus", text: "text-emerald-400", active: "border-emerald-500" },
};

/** Mobile : sélecteur des 3 emplacements du deck (une seule grande carte affichée à la fois). */
export function SlotTabs({
  current,
  cards,
  hrefFor,
}: {
  current: SlotKey;
  cards: Record<SlotKey, UserCard | undefined>;
  hrefFor: (slot: SlotKey) => string;
}) {
  return (
    <nav className="grid grid-cols-3 gap-2 md:hidden" aria-label="Emplacements du deck">
      {(Object.keys(META) as SlotKey[]).map((slot) => {
        const m = META[slot];
        const name = cards[slot]?.card_templates.name.replace(/^Pneu /, "") ?? "Vide";
        const Icon = slot === "boite" ? Settings2 : Cog;
        const t = cards[slot]?.card_templates;
        const img = t ? cardImageUrl(t) : null;
        const tire = slot === "pneus" ? TIRE_THEME[t?.tire_type ?? ""] : undefined;
        const text = tire?.text ?? m.text;
        const active = tire?.border ?? m.active;
        return (
          <Link
            key={slot}
            href={hrefFor(slot)}
            scroll={false}
            className={`flex min-h-20 flex-col items-center justify-center gap-0.5 rounded-xl border-2 bg-[#10131a] px-1 py-2 text-center ${
              slot === current ? active : "border-zinc-800"
            }`}
          >
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img} alt="" className="h-9 w-14 object-contain mix-blend-lighten" />
            ) : slot === "pneus" ? (
              <TireIcon className="h-7 w-7" ring={tire?.stroke} />
            ) : (
              <Icon size={26} strokeWidth={1.5} className={m.text} />
            )}
            <span className={`font-display text-xs uppercase ${text}`}>{m.label}</span>
            <span className="w-full truncate font-display text-[11px] font-bold uppercase text-zinc-200">{name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
