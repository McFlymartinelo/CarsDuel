import { Cog, Disc, Flag, Plus, Settings2, ShieldCheck, ShieldX, TriangleAlert, X, Zap, type LucideIcon } from "lucide-react";
import { CATEGORY_LABEL, RARITY_LABEL, RARITY_THEME, TIRE_LABEL, TIRE_THEME, cardSummary } from "@/lib/format";
import { currentBreakRisk, tireState, warrantyState } from "@/lib/game";
import type { CardTemplate, TradeCard } from "@/lib/types";

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

const TIRE_TONE = {
  ok: { text: "text-emerald-300", bar: "bg-emerald-400" },
  worn: { text: "text-amber-300", bar: "bg-amber-400" },
  critical: { text: "text-red-400", bar: "bg-red-500" },
} as const;

const WARRANTY_TONE = {
  ok: { text: "text-emerald-300", bar: "bg-emerald-400" },
  low: { text: "text-amber-300", bar: "bg-amber-400" },
  expired: { text: "text-red-400", bar: "bg-red-500" },
} as const;

const riskTone = (risk: number) =>
  risk >= 40 ? "text-red-400" : risk >= 15 ? "text-amber-300" : "text-emerald-300";

const formatRisk = (risk: number) => `${Math.round(risk * 100) / 100} %`;

/** Barre de « vitalité » d'une carte : gomme restante ou runs encore couverts par la garantie. */
function TradeCondition({ template, card }: { template: CardTemplate; card: TradeCard }) {
  if (template.category === "pneus") {
    if (card.tire_wear == null) return null;
    const gum = Math.max(0, Math.min(100, card.tire_wear));
    const state = tireState(gum);
    const tone = TIRE_TONE[state.tone];
    return (
      <div className="mt-auto border-t border-line/70 pt-1.5">
        <div className="flex items-center justify-between gap-1 text-[9px] font-semibold uppercase tracking-wide @min-[7rem]:text-[10px]">
          <span className="inline-flex items-center gap-0.5 whitespace-nowrap text-zinc-400 @min-[7rem]:gap-1">
            <Disc size={10} aria-hidden /> <span className="hidden @min-[7rem]:inline">Gomme</span>
          </span>
          <span
            className={`whitespace-nowrap tabular-nums ${tone.text}`}
            title={`Gomme restante : ${Math.round(gum)} % · état ${state.label.toLowerCase()}`}
          >
            {Math.round(gum)} %
          </span>
        </div>
        <div
          className="mt-1 h-1 overflow-hidden rounded-full bg-zinc-800"
          role="img"
          aria-label={`Gomme restante : ${Math.round(gum)} %, état ${state.label.toLowerCase()}`}
        >
          <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${gum}%` }} />
        </div>
      </div>
    );
  }

  if (template.category !== "moteur" && template.category !== "boite") return null;

  const risk = currentBreakRisk(template, card.runs_count);
  const warranty = warrantyState(template, card);
  const warrantyTone = warranty?.expired
    ? WARRANTY_TONE.expired
    : warranty && warranty.remaining / warranty.limit <= 1 / 3
      ? WARRANTY_TONE.low
      : WARRANTY_TONE.ok;
  const warrantyPct = warranty && warranty.limit > 0 ? Math.max(0, Math.min(100, (warranty.remaining / warranty.limit) * 100)) : 0;

  return (
    <div className="mt-auto space-y-1 border-t border-line/70 pt-1.5">
      <div className="flex items-center justify-between gap-1 text-[9px] font-semibold uppercase tracking-wide text-zinc-500 @min-[7rem]:text-[10px]">
        <span
          className="inline-flex items-center gap-0.5 whitespace-nowrap @min-[7rem]:gap-1"
          title={`${card.runs_total} run${card.runs_total > 1 ? "s" : ""} réalisé${card.runs_total > 1 ? "s" : ""}`}
        >
          <Flag size={10} aria-hidden />
          <span className="tabular-nums">{card.runs_total}</span>
          <span className="hidden @min-[7rem]:inline">{card.runs_total > 1 ? "runs" : "run"}</span>
        </span>
        {risk != null && (
          <span
            className={`inline-flex items-center gap-0.5 whitespace-nowrap tabular-nums @min-[7rem]:gap-1 ${riskTone(risk)}`}
            title="Risque de casse actuel"
          >
            <TriangleAlert size={10} aria-hidden />
            {formatRisk(risk)}
          </span>
        )}
      </div>

      {warranty && warranty.limit > 0 && (
        <div>
          <div className="flex items-center justify-between gap-1 text-[9px] font-semibold uppercase tracking-wide @min-[7rem]:text-[10px]">
            <span className={`inline-flex items-center gap-0.5 whitespace-nowrap @min-[7rem]:gap-1 ${warrantyTone.text}`}>
              {warranty.expired ? <ShieldX size={10} aria-hidden /> : <ShieldCheck size={10} aria-hidden />}
              <span className="hidden @min-[7rem]:inline">Garantie</span>
            </span>
            <span
              className={`whitespace-nowrap tabular-nums ${warrantyTone.text}`}
              title={
                warranty.expired
                  ? `Garantie constructeur expirée : ${warranty.used} run${warranty.used === 1 ? "" : "s"} couru${warranty.used === 1 ? "" : "s"} sur ${warranty.limit}`
                  : `Garantie constructeur : ${warranty.remaining} run${warranty.remaining === 1 ? "" : "s"} restant${warranty.remaining === 1 ? "" : "s"} sur ${warranty.limit}`
              }
            >
              {warranty.remaining}/{warranty.limit}
            </span>
          </div>
          <div
            className="mt-1 h-1 overflow-hidden rounded-full bg-zinc-800"
            role="img"
            aria-label={`Garantie : ${warranty.remaining} run${warranty.remaining === 1 ? "" : "s"} restant${warranty.remaining === 1 ? "" : "s"} sur ${warranty.limit}`}
          >
            <div className={`h-full rounded-full ${warrantyTone.bar}`} style={{ width: `${warrantyPct}%` }} />
          </div>
        </div>
      )}
    </div>
  );
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
  const summary = cardSummary(t);
  const risk = t.category === "moteur" || t.category === "boite" ? currentBreakRisk(t, card.runs_count) : null;
  const warranty = warrantyState(t, card);
  const details = [
    summary,
    card.runs_total > 0 ? `${card.runs_total} run${card.runs_total > 1 ? "s" : ""}` : null,
    risk != null ? `risque de casse ${formatRisk(risk)}` : null,
    warranty && warranty.limit > 0
      ? warranty.expired
        ? `garantie expirée (${warranty.used}/${warranty.limit})`
        : `garantie ${warranty.remaining}/${warranty.limit} runs`
      : null,
    card.tire_wear != null ? `gomme ${Math.round(card.tire_wear)} %` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const content = (
    <>
      <div className={`relative flex h-16 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-gradient-to-b from-[#12151c] to-[#0a0c10] ${theme.frame}`}>
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
      <TradeCondition template={t} card={card} />
    </>
  );

  return (
    <div className="relative flex min-w-0 @container" title={`${t.name} — ${details}`}>
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          aria-label={label ?? `Modifier l'emplacement : ${t.name}`}
          className="flex h-full w-full flex-col rounded-lg border border-line-strong/80 bg-[#0d1016] p-1.5 text-left transition-colors hover:border-amber-500/70 hover:bg-[#141820] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          {content}
        </button>
      ) : (
        <div className="flex h-full w-full flex-col rounded-lg border border-line-strong/80 bg-[#0d1016] p-1.5">{content}</div>
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
      className="flex min-h-[8.75rem] w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line-strong bg-[#0b0e13] px-1 text-center text-zinc-500 transition-colors hover:border-amber-500/60 hover:bg-amber-500/5 hover:text-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
    >
      <Plus size={20} strokeWidth={1.7} />
      <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
    </button>
  );
}
