import { Cog, Swords } from "lucide-react";
import { THEME } from "@/components/CardView";
import { cardImageUrl } from "@/lib/card-images";
import { CATEGORY_LABEL, RARITY_LABEL, TIRE_LABEL, TIRE_THEME, cardSummary } from "@/lib/format";
import type { CardTemplate, UserCard } from "@/lib/types";

/**
 * Vue compacte d'une carte : miniature, nom, rareté, résumé des stats et actions sur une ligne.
 * Même habillage (cadre, couleur) que CardView. `children` : actions, à droite (dessous sur mobile).
 */
export function CardRow({
  template,
  card,
  image,
  note,
  children,
}: {
  template: CardTemplate;
  card?: Pick<UserCard, "runs_count" | "tire_wear" | "is_destroyed">;
  image?: string | null;
  note?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const rarity = template.rarity;
  const tire = template.category === "pneus" ? TIRE_THEME[template.tire_type ?? ""] : undefined;
  const theme = rarity ? THEME[rarity] : tire ?? THEME.neutre;
  const img = image === undefined ? cardImageUrl(template) : image;
  const bonus = template.category === "bonus";
  const title = bonus ? (template.description?.trim() || template.name) : template.name;
  const tag = bonus ? null : rarity ? RARITY_LABEL[rarity] : template.category === "pneus" ? (TIRE_LABEL[template.tire_type ?? ""] ?? "Pneus") : null;

  return (
    <div className={`relative flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border-2 bg-[#0b0d12] p-2 ${theme.frame}`}>
      <div className={`relative flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-gradient-to-b from-[#12151c] to-[#0a0c10] ${theme.inner}`}>
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="" loading="lazy" className="h-full w-full object-contain p-1 mix-blend-lighten" />
        ) : (
          <Cog aria-hidden strokeWidth={1.2} className={`h-8 w-8 opacity-40 ${theme.accent}`} />
        )}
      </div>

      <div className="min-w-0 flex-1 basis-40">
        <p className={`truncate font-display text-lg font-bold leading-tight text-white ${bonus ? "normal-case" : "uppercase"}`}>{title}</p>
        <p className={`font-display text-xs font-semibold uppercase tracking-wider ${theme.accent}`}>
          {CATEGORY_LABEL[template.category]}{tag ? ` · ${tag}` : ""}
          {card?.is_destroyed && <span className="text-red-500"> · Détruite</span>}
          {card && template.category !== "pneus" && template.category !== "bonus" && card.runs_count > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 normal-case tracking-normal text-zinc-400">
              <Swords size={12} /> {card.runs_count}
            </span>
          )}
        </p>
        {!bonus && <p className="truncate text-xs text-zinc-400">{cardSummary(template, card)}</p>}
        {note}
      </div>

      {children && <div className="relative z-10 w-full sm:w-auto sm:min-w-44">{children}</div>}
    </div>
  );
}
