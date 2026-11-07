import Link from "next/link";
import { Handshake, Store } from "lucide-react";

const tab = (active: boolean) =>
  `inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors sm:flex-none ${
    active ? "bg-amber-500 text-black" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
  }`;

/** Bascule entre l'ancienne marketplace et le nouvel onglet de troc. */
export function MarketplaceTabs({
  current,
  marketHref,
  exchangeHref,
  incomingCount,
}: {
  current: "marche" | "echanges";
  marketHref: string;
  exchangeHref: string;
  incomingCount: number;
}) {
  return (
    <nav className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-panel p-1 sm:inline-flex" aria-label="Sections de la marketplace">
      <Link href={marketHref} scroll={false} aria-current={current === "marche" ? "page" : undefined} className={tab(current === "marche")}>
        <Store size={17} strokeWidth={2} />
        Marché de l&apos;occasion
      </Link>
      <Link
        href={exchangeHref}
        scroll={false}
        aria-current={current === "echanges" ? "page" : undefined}
        className={tab(current === "echanges")}
      >
        <Handshake size={17} strokeWidth={2} />
        Échanges
        {incomingCount > 0 && (
          <span
            className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none tabular-nums ${
              current === "echanges" ? "bg-black/20 text-black" : "bg-amber-500 text-black"
            }`}
          >
            {incomingCount}
          </span>
        )}
      </Link>
    </nav>
  );
}
