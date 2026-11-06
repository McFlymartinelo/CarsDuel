import { Cog, Disc, Plus, Settings2, X, Zap, type LucideIcon } from "lucide-react";
import { CATEGORY_LABEL, RARITY_LABEL, RARITY_THEME, TIRE_LABEL, TIRE_THEME, cardSummary } from "@/lib/format";
import type { TradeCard } from "@/lib/types";

const ICONS: Record<TradeCard["card_templates"]["category"], LucideIcon> = {
  moteur: Cog,
  boite: Settings2,
  pneus: Disc,
  bonus: Zap,
};

function themeOf(card: TradeCard) {
  const t = card.card_templates;
  if (t.rarity) {
    const theme = RARITY_THEME[t.rarity];
    return { frame: theme.frame, glow: theme.glow, accent: theme.label, tag: RARITY_LABEL[t.rarity] };
  }
  if (t.category === "pneus") {
    const theme = TIRE_THEME[t.tire_type ?? ""];
    return {
      frame: theme?.frame ?? "border-zinc-500",
      glow: theme?.glow ?? "from-zinc-500/15",
      accent: theme?.text ?? "text-zinc-300",
      tag: TIRE_LABEL[t.tire_type ?? ""] ?? "Pneus",
    };
  }
  return { frame: "border-zinc-500", glow: "from-zinc-500/15", accent: "text-zinc-300", tag: null };
}

/** Carte compacte utilisée dans la composition, l'inventaire du troc et le détail d'une offre. */
export function TradeCardTile({
  card,
  onClick,
  onRemove,
  label,
}: {
  card: TradeCard;
  /** Ouvre le sélecteur d'inventaire (emplacement de composition). */
  onClick?: () => void;
  /** Retire la carte de l'emplacement. */
  onRemove?: () => void;
  /** Texte du bouton pour les lecteurs d'écran. */
  label?: string;
}) {
  const t = card.card_templates;
  const theme = themeOf(card);
  const Icon = ICONS[t.category];
  const summary = cardSummary(t, card);

  const content = (
    <>
      <div className={`relative flex h-16 items-center justify-center overflow-hidden rounded-md border bg-gradient-to-b from-[#12151c] to-[#0a0c10] ${theme.frame}`}>
        <div className={`pointer-events-none absolute inset-0 bg-gradient-to-t ${theme.glow} to-transparent`} />
        {card.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.image} alt="" loading="lazy" className="relative h-full w-full object-contain p-1 mix-blend-lighten" />
        ) : (
          <Icon aria-hidden strokeWidth={1.2} className={`relative h-7 w-7 opacity-50 ${theme.accent}`} />
        )}
        {card.is_listed && (
          <span className="absolute left-1 top-1 rounded border border-sky-500/60 bg-sky-500/15 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-sky-300">
            En vente
          </span>
        )}
      </div>
      <p className="mt-1 line-clamp-2 min-h-[1.9rem] text-[11px] font-semibold uppercase leading-tight text-zinc-100">{t.name}</p>
      <p className={`truncate text-[10px] font-semibold uppercase tracking-wide ${theme.accent}`}>
        {CATEGORY_LABEL[t.category]}
        {theme.tag ? ` · ${theme.tag}` : ""}
      </p>
      <p className="line-clamp-1 text-[10px] text-zinc-500">{summary}</p>
    </>
  );

  return (
    <div className="relative min-w-0" title={`${t.name} — ${summary}`}>
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          aria-label={label ?? `Modifier l'emplacement : ${t.name}`}
          className="block w-full rounded-lg border border-zinc-700/80 bg-[#0d1016] p-1.5 text-left transition-colors hover:border-amber-500/70 hover:bg-[#141820] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          {content}
        </button>
      ) : (
        <div className="rounded-lg border border-zinc-700/80 bg-[#0d1016] p-1.5">{content}</div>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          aria-label={`Retirer ${t.name}`}
          className="absolute -right-1.5 -top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-red-500/70 bg-[#1a0f12] text-red-400 shadow-lg hover:bg-red-600 hover:text-white"
        >
          <X size={13} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}

/** Emplacement vide cliquable (5 par colonne). */
export function TradeEmptySlot({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[8.75rem] w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-700 bg-[#0b0e13] px-1 text-center text-zinc-500 transition-colors hover:border-amber-500/60 hover:bg-amber-500/5 hover:text-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
    >
      <Plus size={20} strokeWidth={1.7} />
      <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
    </button>
  );
}
