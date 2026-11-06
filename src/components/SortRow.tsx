"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowDownAZ,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  Coins,
  Disc,
  Gauge,
  Hash,
  Layers,
  Timer,
  Weight,
  type LucideIcon,
} from "lucide-react";

/** Icône et sens de chaque tri connu : identiques sur toutes les pages. */
const META: Record<string, { icon: LucideIcon; down: boolean }> = {
  power: { icon: Gauge, down: true },
  weight: { icon: Weight, down: false },
  shift: { icon: Timer, down: false },
  ref: { icon: Hash, down: false },
  price: { icon: Coins, down: false },
  gomme: { icon: Disc, down: false },
  qty: { icon: Layers, down: true },
  name: { icon: ArrowDownAZ, down: false },
};

export interface SortOption {
  key: string;
  label: string;
  title: string;
}

/**
 * Rangée « Trier » commune à toutes les pages : libellé à gauche et segments
 * avec icône et flèche sur desktop, sélecteur compact sur mobile — le même
 * comportement que la boutique.
 *
 * Navigation : soit `hrefFor` (client), soit `hrefs` (composants serveur,
 * `hrefs[""]` = retirer le tri). État local : `onSelect`.
 */
export function SortRow({
  options,
  current,
  hrefFor,
  hrefs,
  onSelect,
  label = "Trier",
  ariaLabel,
}: {
  options: readonly SortOption[];
  current?: string;
  hrefFor?: (key: string) => string;
  /** Variante sérialisable de `hrefFor`, pour les composants serveur. */
  hrefs?: Record<string, string>;
  onSelect?: (key: string) => void;
  label?: string;
  ariaLabel?: string;
}) {
  const router = useRouter();
  if (options.length === 0) return null;

  const choose = (key: string) => {
    if (onSelect) {
      onSelect(key);
      return;
    }
    const target = hrefs ? hrefs[key] : hrefFor?.(key);
    if (target) router.push(target);
  };

  const segment = (on: boolean) =>
    `inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
      on ? "bg-amber-500 text-black" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
    }`;

  return (
    <>
      <div className="hidden grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-x-3 gap-y-2 md:grid">
        <span className="pt-2 font-display text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{label}</span>
        <nav
          className="inline-flex max-w-full flex-wrap justify-self-start gap-1 overflow-x-auto rounded-xl border border-zinc-800 bg-[#10131a] p-1"
          aria-label={ariaLabel ?? label}
        >
          {options.map((option) => {
            const on = option.key === current;
            const meta = META[option.key];
            const Icon = meta?.icon;
            const Direction = meta?.down ? ArrowDown : ArrowUp;
            const href = hrefFor ? hrefFor(option.key) : hrefs?.[option.key];
            const content = (
              <>
                {Icon && <Icon size={15} strokeWidth={2} />}
                {option.label}
                <Direction size={14} strokeWidth={2.25} className={on ? "text-black/70" : "text-zinc-600"} />
              </>
            );
            return href ? (
              <Link
                key={option.key}
                href={href}
                scroll={false}
                title={on ? "Retirer le tri" : option.title}
                aria-current={on ? "true" : undefined}
                className={segment(on)}
              >
                {content}
              </Link>
            ) : (
              <button
                key={option.key}
                type="button"
                title={on ? "Retirer le tri" : option.title}
                aria-pressed={on}
                onClick={() => choose(option.key)}
                className={segment(on)}
              >
                {content}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="md:hidden">
        <div className="relative flex min-w-0 items-center">
          <ArrowUpDown size={14} strokeWidth={2} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <ChevronDown size={14} strokeWidth={2.25} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500" />
          <select
            aria-label={ariaLabel ?? label}
            value={current ?? ""}
            onChange={(event) => choose(event.target.value)}
            className="!h-11 !w-full appearance-none truncate rounded-xl border border-white/[0.06] !bg-[#0a0d12] !py-0 !pl-9 !pr-8 text-sm text-zinc-200"
          >
            <option value="">Par défaut</option>
            {options.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
}
