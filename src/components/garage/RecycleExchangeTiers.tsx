"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Boxes,
  Check,
  Cog,
  Crown,
  Dices,
  Settings2,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { CardDraw } from "@/components/CardDraw";
import { RARITY_LABEL } from "@/lib/format";
import { useDialogA11y } from "@/lib/use-dialog-a11y";
import {
  RECYCLE_EXCHANGE_TIER_LIST,
  type RecycleExchangeCategory,
  type RecycleExchangeOdds,
  type RecycleExchangeResult,
  type RecycleExchangeTier,
  type RecycleExchangeTierConfig,
} from "@/lib/recycle";
import type { ActionState } from "@/lib/types";

type ExchangeState = ActionState<RecycleExchangeResult>;
type ExchangeAction = (prev: ExchangeState, fd: FormData) => Promise<ExchangeState>;
type Step = "category" | "confirm";

const TIER_UI: Record<RecycleExchangeTier, { icon: LucideIcon; accent: string; iconBox: string; cta: string; ring: string }> = {
  standard: {
    icon: Dices,
    accent: "text-zinc-200",
    iconBox: "border-zinc-600 bg-zinc-800/70 text-zinc-300",
    cta: "bg-zinc-200 text-black group-hover:bg-white",
    ring: "hover:border-zinc-600",
  },
  ameliore: {
    icon: Sparkles,
    accent: "text-cyan-300",
    iconBox: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300",
    cta: "bg-cyan-400 text-black group-hover:bg-cyan-300",
    ring: "hover:border-cyan-600/70",
  },
  prestige: {
    icon: Crown,
    accent: "text-amber-300",
    iconBox: "border-amber-500/40 bg-amber-500/10 text-amber-300",
    cta: "bg-amber-400 text-black group-hover:bg-amber-300",
    ring: "hover:border-amber-500/70",
  },
};

const RARITY_DOT: Record<string, string> = {
  commune: "bg-zinc-400",
  rare: "bg-blue-400",
  tres_rare: "bg-cyan-400",
  epique: "bg-purple-400",
  legendaire: "bg-amber-400",
};

const RARITY_BAR: Record<string, string> = {
  commune: "bg-zinc-400",
  rare: "bg-blue-400",
  tres_rare: "bg-cyan-400",
  epique: "bg-purple-400",
  legendaire: "bg-amber-400",
};

const CATEGORIES: {
  key: RecycleExchangeCategory;
  label: string;
  description: string;
  icon: LucideIcon;
  accent: string;
}[] = [
  {
    key: "moteur",
    label: "Moteur",
    description: "Architecture, puissance et poids.",
    icon: Cog,
    accent: "text-orange-300",
  },
  {
    key: "boite",
    label: "Boîte de vitesses",
    description: "Type, temps de passage et poids.",
    icon: Settings2,
    accent: "text-sky-300",
  },
];

const formatPct = (pct: number) => `${pct.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
const cubesLabel = (n: number) => `${n.toLocaleString("fr-FR")} cube${n === 1 ? "" : "s"}`;

function OddsList({ odds }: { odds: RecycleExchangeOdds[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
      {odds.map(({ rarity, pct }) => (
        <div key={rarity} className="flex items-center justify-between gap-2 text-[11px]">
          <span className="inline-flex min-w-0 items-center gap-1.5 text-zinc-400">
            <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${RARITY_DOT[rarity]}`} />
            <span className="truncate">{RARITY_LABEL[rarity]}</span>
          </span>
          <span className="font-display font-semibold tabular-nums text-zinc-300">{formatPct(pct)}</span>
        </div>
      ))}
    </div>
  );
}

function OddsTable({ odds }: { odds: RecycleExchangeOdds[] }) {
  return (
    <div className="space-y-2">
      {odds.map(({ rarity, pct }) => (
        <div key={rarity} className="grid grid-cols-[5.75rem_1fr_3.25rem] items-center gap-2 sm:grid-cols-[6.5rem_1fr_3.5rem]">
          <span className="inline-flex items-center gap-1.5 text-xs text-zinc-300">
            <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${RARITY_DOT[rarity]}`} />
            {RARITY_LABEL[rarity]}
          </span>
          <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <span className={`block h-full rounded-full ${RARITY_BAR[rarity]}`} style={{ width: `${pct}%` }} />
          </span>
          <span className="text-right font-display text-xs font-semibold tabular-nums text-zinc-300">{formatPct(pct)}</span>
        </div>
      ))}
    </div>
  );
}

export function RecycleExchangeTiers({
  cubes,
  action,
  onCubesChange,
}: {
  cubes: number;
  action: ExchangeAction;
  onCubesChange: (cubes: number) => void;
}) {
  const [tier, setTier] = useState<RecycleExchangeTierConfig | null>(null);
  const [step, setStep] = useState<Step>("category");
  const [category, setCategory] = useState<RecycleExchangeCategory | null>(null);
  const [result, setResult] = useState<RecycleExchangeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  const openTier = (next: RecycleExchangeTierConfig) => {
    setTier(next);
    setStep("category");
    setCategory(null);
    setError(null);
  };

  const close = () => {
    if (pending) return;
    setTier(null);
    setError(null);
  };

  const { setPanel: setDialogPanel, onKeyDown: onDialogKeyDown } = useDialogA11y<HTMLDivElement>({
    open: Boolean(tier),
    onClose: close,
  });

  const confirm = async () => {
    if (!tier || !category || pending) return;
    setPending(true);
    setError(null);
    const fd = new FormData();
    fd.set("tier", tier.key);
    fd.set("category", category);
    try {
      const res = await action(null, fd);
      if (!res?.ok) {
        setError(res?.message ?? "Le tirage a échoué. Réessayez.");
        return;
      }
      const data = res.data;
      if (!data || data.cards.length === 0) {
        setError("La carte n'a pas pu être récupérée. Rechargez la page.");
        return;
      }
      onCubesChange(data.cubesLeft);
      // Rafraîchit le layout serveur : le solde de cubes du header (Nav) est
      // mis à jour sans attendre une navigation.
      router.refresh();
      setResult(data);
      setTier(null);
    } catch {
      setError("Le tirage a échoué. Vérifiez votre connexion et réessayez.");
    } finally {
      setPending(false);
    }
  };

  const selectedCategory = CATEGORIES.find((c) => c.key === category);
  const SelectedIcon = selectedCategory?.icon;
  const tierUi = tier ? TIER_UI[tier.key] : null;
  const TierIcon = tierUi?.icon;

  return (
    <>
      <div className="grid gap-3 md:grid-cols-3">
        {RECYCLE_EXCHANGE_TIER_LIST.map((config) => {
          const ui = TIER_UI[config.key];
          const Icon = ui.icon;
          const missing = Math.max(0, config.cost - cubes);
          const disabled = missing > 0;
          return (
            <button
              key={config.key}
              type="button"
              onClick={() => openTier(config)}
              disabled={disabled}
              className={`group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-[#141821] to-[#0b0d12] text-left transition ${ui.ring} hover:bg-[#171b24] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-line`}
            >
              <span className="relative block w-full overflow-hidden border-b border-line/70 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.05),transparent_70%)] px-2 pt-2">
                <Image
                  src={config.image}
                  alt=""
                  width={1200}
                  height={600}
                  sizes="(min-width: 768px) 33vw, 100vw"
                  className="mx-auto h-32 w-full object-contain drop-shadow-[0_10px_22px_rgba(0,0,0,0.6)] transition-transform duration-300 group-hover:scale-[1.03] sm:h-36"
                />
              </span>

              <span className="flex w-full flex-1 flex-col p-4 pt-3">
                <span className="flex w-full items-start gap-3">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${ui.iconBox}`}>
                    <Icon size={24} strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block font-display text-lg font-bold uppercase leading-tight ${ui.accent}`}>
                      {config.label}
                    </span>
                    <span className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-orange-500/30 bg-orange-500/5 px-2 py-0.5 font-display text-sm font-semibold text-orange-200">
                      <Boxes size={14} strokeWidth={2.1} />
                      {config.cost} cubes
                    </span>
                  </span>
                </span>

                <span className="mt-3 block text-xs leading-relaxed text-zinc-400">{config.tagline}</span>

                <span className="mt-3 block rounded-xl border border-line/80 bg-black/25 p-2.5">
                  <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Probabilités de rareté
                  </span>
                  <OddsList odds={config.odds} />
                </span>

                <span className="mt-auto flex w-full items-center justify-between gap-2 pt-3">
                  <span className="text-[11px] text-zinc-500">
                    {disabled ? `Il manque ${cubesLabel(missing)}` : "Pièce neuve · 0 run"}
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-display text-xs font-bold uppercase tracking-wide transition ${disabled ? "bg-zinc-800 text-zinc-500" : ui.cta}`}>
                    Choisir
                    <ArrowRight size={14} strokeWidth={2.5} />
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {tier && tierUi && TierIcon && (
        <div
          className="fixed inset-0 z-[85] flex items-center justify-center overflow-y-auto bg-[#030507]/80 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-sm sm:px-6 sm:pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pt-[max(1.5rem,env(safe-area-inset-top))]"
          role="dialog"
          aria-modal="true"
          aria-label={`${tier.label} — ${step === "category" ? "choix de la catégorie" : "confirmation"}`}
        >
          <div
            ref={setDialogPanel}
            tabIndex={-1}
            onKeyDown={onDialogKeyDown}
            className="relative my-auto flex max-h-[calc(94dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-full max-w-xl flex-col overflow-y-auto rounded-3xl border border-amber-500/30 bg-gradient-to-b from-[#141821] to-[#090b10] p-4 shadow-[0_24px_100px_rgba(0,0,0,0.85)] outline-none sm:p-6"
          >
            <button
              type="button"
              onClick={close}
              disabled={pending}
              aria-label="Fermer"
              className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line-strong bg-header text-zinc-400 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X size={18} />
            </button>

            <div className="relative -mx-4 -mt-4 mb-4 overflow-hidden rounded-t-3xl border-b border-line/80 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.06),transparent_70%)] px-2 py-2 sm:-mx-6 sm:-mt-6 sm:px-4">
              <Image
                src={tier.image}
                alt=""
                width={1200}
                height={600}
                sizes="(min-width: 640px) 36rem, 100vw"
                className="mx-auto h-28 w-full object-contain drop-shadow-[0_12px_26px_rgba(0,0,0,0.65)] sm:h-36"
              />
            </div>

            <div className="flex items-center gap-3 pr-10">
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${tierUi.iconBox}`}>
                <TierIcon size={26} strokeWidth={1.7} />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Palier sélectionné</p>
                <h2 className={`font-display text-xl font-bold uppercase leading-tight ${tierUi.accent}`}>{tier.label}</h2>
              </div>
              <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-orange-500/40 bg-orange-500/5 px-2.5 py-1 font-display text-sm font-semibold text-orange-200">
                <Boxes size={16} strokeWidth={2.1} />
                {tier.cost} cubes
              </span>
            </div>

            <div className="mt-4 flex items-center justify-center gap-2 font-display text-[11px] font-semibold uppercase tracking-wider">
              <span className={step === "category" ? "text-amber-300" : "text-zinc-500"}>1. Catégorie</span>
              <ArrowRight size={12} className="text-zinc-600" />
              <span className={step === "confirm" ? "text-amber-300" : "text-zinc-500"}>2. Confirmation</span>
            </div>

            {step === "category" ? (
              <>
                <div className="mt-4 rounded-xl border border-line bg-black/25 p-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Probabilités de rareté</p>
                  <OddsTable odds={tier.odds} />
                </div>

                <p className="mt-4 text-sm font-semibold text-white">Choisissez la catégorie de la pièce</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {CATEGORIES.map(({ key, label, description, icon: Icon, accent }) => {
                    const active = category === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setCategory(key)}
                        className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                          active ? "border-amber-400 bg-amber-500/10" : "border-line-strong bg-panel hover:border-zinc-500"
                        }`}
                      >
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${active ? "border-amber-400/50 bg-amber-500/10" : "border-line-strong bg-black/30"} ${accent}`}>
                          <Icon size={21} strokeWidth={1.9} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-white">{label}</span>
                          <span className="block text-[11px] text-zinc-400">{description}</span>
                        </span>
                        <span
                          aria-hidden
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                            active ? "border-amber-400 bg-amber-400 text-black" : "border-zinc-600 text-transparent"
                          }`}
                        >
                          <Check size={13} strokeWidth={3} />
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={close}
                    className="min-h-11 rounded-xl border border-zinc-600 bg-[#11141a] px-4 font-display text-sm font-bold uppercase text-zinc-200 transition hover:border-zinc-400 hover:bg-zinc-800"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep("confirm")}
                    disabled={!category}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-amber-400 to-amber-500 px-5 font-display text-sm font-bold uppercase text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:from-zinc-700 disabled:to-zinc-700 disabled:text-zinc-400"
                  >
                    Suivant
                    <ArrowRight size={16} strokeWidth={2.5} />
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mt-4 space-y-2 rounded-xl border border-line-strong bg-panel p-4">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-zinc-400">Palier</span>
                    <span className={`font-display font-semibold ${tierUi.accent}`}>{tier.label}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-zinc-400">Catégorie</span>
                    <span className="inline-flex items-center gap-1.5 font-semibold text-white">
                      {SelectedIcon && <SelectedIcon size={16} strokeWidth={2} className={selectedCategory?.accent} />}
                      {selectedCategory?.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-line pt-2 text-sm">
                    <span className="text-zinc-400">Montant débité</span>
                    <span className="inline-flex items-center gap-1.5 font-display text-lg font-bold text-orange-300">
                      <Boxes size={17} strokeWidth={2.1} />
                      {tier.cost} cubes
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-xs text-zinc-500">
                    <span>Solde après tirage</span>
                    <span className="tabular-nums">{cubesLabel(Math.max(0, cubes - tier.cost))}</span>
                  </div>
                </div>

                <p className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs leading-relaxed text-zinc-300">
                  La pièce sera générée <b className="text-emerald-300">neuve</b> (100 % garantie, 0 run) puis ajoutée
                  directement à votre inventaire. Le tirage est définitif.
                </p>

                {error && <p className="mt-3 rounded-lg border border-red-700 bg-red-950/40 p-3 text-sm text-red-300">{error}</p>}

                <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={close}
                    disabled={pending}
                    className="min-h-11 rounded-xl border border-zinc-600 bg-[#11141a] px-4 font-display text-sm font-bold uppercase text-zinc-200 transition hover:border-zinc-400 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={confirm}
                    disabled={pending}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-amber-400 to-amber-500 px-5 font-display text-sm font-bold uppercase text-black transition hover:brightness-110 disabled:cursor-wait disabled:opacity-70"
                  >
                    {pending ? "Tirage…" : "Confirmer le tirage"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {result && (
        <CardDraw
          cards={result.cards}
          title={RECYCLE_EXCHANGE_TIER_LIST.find((t) => t.key === result.tier)?.label ?? "Échange"}
          onClose={() => setResult(null)}
        />
      )}
    </>
  );
}
