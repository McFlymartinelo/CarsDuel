import Link from "next/link";
import { ArrowDown, ArrowUp, Coins, Gauge, Hash, Timer, Weight, type LucideIcon } from "lucide-react";

const META: Record<string, { icon: LucideIcon; down: boolean }> = {
  power: { icon: Gauge, down: true },
  weight: { icon: Weight, down: false },
  shift: { icon: Timer, down: false },
  ref: { icon: Hash, down: false },
  price: { icon: Coins, down: false },
};

export function SortLinks({
  label,
  options,
  current,
  hrefFor,
}: {
  label: string;
  options: readonly { key: string; label: string; title: string }[];
  current?: string;
  hrefFor: (key: string | null) => string;
}) {
  const active = options.find((o) => o.key === current);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{label}</span>
      <nav className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-zinc-800 bg-[#10131a] p-1" aria-label={label}>
        {options.map((o) => {
          const on = o.key === current;
          const meta = META[o.key];
          const Icon = meta?.icon;
          const Dir = meta?.down ? ArrowDown : ArrowUp;
          return (
            <Link
              key={o.key}
              href={hrefFor(on ? null : o.key)}
              scroll={false}
              title={on ? "Retirer le tri" : o.title}
              aria-current={on ? "true" : undefined}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                on ? "bg-amber-500 text-black" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
              }`}
            >
              {Icon && <Icon size={15} strokeWidth={2} />}
              {o.label}
              <Dir size={14} strokeWidth={2.25} className={on ? "text-black/70" : "text-zinc-600"} />
            </Link>
          );
        })}
      </nav>
      {active && <span className="text-xs text-amber-300/90">{active.title}</span>}
    </div>
  );
}
