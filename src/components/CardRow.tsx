import { Cog, Flag, ShieldCheck, Trophy } from "lucide-react";
import { THEME } from "@/components/CardView";
import { cardImageUrl } from "@/lib/card-images";
import { CATEGORY_LABEL, RARITY_LABEL, TIRE_LABEL, TIRE_THEME, cardSummary } from "@/lib/format";
import { warrantyState } from "@/lib/game";
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
  card?: Pick<UserCard, "runs_count" | "runs_total" | "wins_count" | "tire_wear" | "is_destroyed" | "is_listed" | "warranty_used" | "warranty_duels" | "warranty_extended">;
  image?: string | null;
  note?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const rarity = template.rarity;
  const tire = template.category === "pneus" ? TIRE_THEME[template.tire_type ?? ""] : undefined;
  const theme = rarity ? THEME[rarity] : tire ?? THEME.neutre;
  const img = image === undefined ? cardImageUrl(template) : image;
  const tag = rarity ? RARITY_LABEL[rarity] : template.category === "pneus" ? (TIRE_LABEL[template.tire_type ?? ""] ?? "Pneus") : null;
  const warranty = warrantyState(template, card);

  return (
    <div className={`relative flex w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border-2 bg-[#0b0d12] p-2 ${theme.frame}`}>
      <div className={`relative flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-gradient-to-b from-[#12151c] to-[#0a0c10] ${theme.inner}`}>
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="" loading="lazy" className="h-full w-full object-contain p-1 mix-blend-lighten" />
        ) : (
          <Cog aria-hidden strokeWidth={1.2} className={`h-8 w-8 opacity-40 ${theme.accent}`} />
        )}
      </div>

      <div className="min-w-0 flex-1 basis-40">
        <p className="truncate font-display text-lg font-bold uppercase leading-tight text-white">{template.name}</p>
        <p className={`font-display text-xs font-semibold uppercase tracking-wider ${theme.accent}`}>
          {CATEGORY_LABEL[template.category]}{tag ? ` · ${tag}` : ""}
          {card?.is_destroyed && <span className="text-red-500"> · Détruite</span>}
          {card && template.category !== "pneus" && template.category !== "bonus" && card.runs_total > 0 && (
            <span className="ml-2 inline-flex items-center gap-2 normal-case tracking-normal text-zinc-400">
              <span title={card.runs_total > 1 ? `${card.runs_total} runs réalisés` : `${card.runs_total} run réalisé`} className="inline-flex items-center gap-1">
                <Flag size={12} /> <span className="tabular-nums">{card.runs_total}</span>
              </span>
              <span title={card.wins_count === 1 ? "1 victoire" : `${card.wins_count} victoires`} className="inline-flex items-center gap-1">
                <Trophy size={12} className="text-amber-400" /> <span className="tabular-nums">{card.wins_count}</span>
              </span>
            </span>
          )}
          {warranty && warranty.limit > 0 && (
            <span
              title={
                card
                  ? warranty.expired
                    ? `Garantie constructeur expirée : ${warranty.used} run(s) couru(s) sur ${warranty.limit}`
                    : `Garantie constructeur : ${warranty.remaining} run(s) restant(s) sur ${warranty.limit}`
                  : `Garantie constructeur : ${warranty.limit} run(s)`
              }
              className={`ml-2 inline-flex items-center gap-1 normal-case tracking-normal ${
                warranty.expired ? "text-red-400" : "text-emerald-300"
              }`}
            >
              <ShieldCheck size={12} />
              {warranty.expired
                ? "Garantie expirée"
                : `${warranty.remaining} run${warranty.remaining === 1 ? "" : "s"} sous garantie restant${warranty.remaining === 1 ? "" : "s"}`}
              {warranty.repairable && <span className="font-semibold"> · réparable</span>}
            </span>
          )}
        </p>
        <p className="line-clamp-2 text-xs text-zinc-400">{cardSummary(template, card)}</p>
        {note}
      </div>

      {children && <div className="relative z-10 w-full min-w-0 sm:w-auto sm:min-w-44">{children}</div>}
    </div>
  );
}
