import Link from "next/link";
import { LayoutGrid, List } from "lucide-react";

export type CardViewMode = "cartes" | "liste";

/** Paramètre d'URL `vue` : "liste" active la vue compacte, tout le reste donne les cartes. */
export const viewMode = (v: string | undefined): CardViewMode => (v === "liste" ? "liste" : "cartes");

const OPTIONS: { key: CardViewMode; label: string; icon: typeof List }[] = [
  { key: "cartes", label: "Cartes", icon: LayoutGrid },
  { key: "liste", label: "Liste", icon: List },
];

export function ViewToggle({ current, hrefFor }: { current: CardViewMode; hrefFor: (mode: CardViewMode) => string }) {
  return (
    <nav className="inline-flex gap-1 rounded-xl border border-zinc-800 bg-[#10131a] p-1" aria-label="Affichage">
      {OPTIONS.map((o) => {
        const on = o.key === current;
        return (
          <Link
            key={o.key}
            href={hrefFor(o.key)}
            scroll={false}
            aria-current={on ? "true" : undefined}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              on ? "bg-amber-500 text-black" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
            }`}
          >
            <o.icon size={15} strokeWidth={2} />
            {o.label}
          </Link>
        );
      })}
    </nav>
  );
}
