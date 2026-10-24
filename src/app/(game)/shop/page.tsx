import Link from "next/link";
import { Cog, Disc, Settings2, type LucideIcon } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { ActionForm } from "@/components/ActionForm";
import { CardView } from "@/components/CardView";
import { SortLinks } from "@/components/SortLinks";
import { ENGINE_SORTS, GEARBOX_SORTS, compareTemplates, engineSort, gearboxSort } from "@/lib/catalog-sort";
import { RARITY_LABEL } from "@/lib/format";
import { loadShopPage } from "@/lib/queries";
import type { Category, Rarity } from "@/lib/types";
import { buyShopItem } from "./actions";

export const metadata = { title: "Boutique — CarsDuel" };

const TABS: { key: string; label: string; category: Category; icon: LucideIcon }[] = [
  { key: "moteurs", label: "Moteurs", category: "moteur", icon: Cog },
  { key: "boites", label: "Boîtes", category: "boite", icon: Settings2 },
  { key: "pneus", label: "Pneus", category: "pneus", icon: Disc },
];

const RARITIES = Object.keys(RARITY_LABEL) as Rarity[];

const RARITY_DOT: Record<Rarity, string> = {
  commune: "bg-zinc-400",
  rare: "bg-blue-400",
  tres_rare: "bg-cyan-400",
  epique: "bg-purple-400",
  legendaire: "bg-amber-400",
};

const seg = (active: boolean) =>
  `inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
    active ? "bg-amber-500 text-black" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
  }`;

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ tab?: string; rarity?: string; sort?: string }> }) {
  const { tab: tabParam, rarity: rarityParam, sort: sortParam } = await searchParams;
  const { user } = await requireUser();
  const { items, modifiers: tirePerfs } = await loadShopPage(user.id);

  const tab = TABS.find((t) => t.key === tabParam) ?? TABS[0];
  const inTab = items.filter((it) => it.card_templates.category === tab.category);
  const hasRarity = tab.category !== "pneus";
  const rarity = hasRarity ? RARITIES.find((r) => r === rarityParam) : undefined;
  const sort = tab.category === "moteur" ? engineSort(sortParam) : tab.category === "boite" ? gearboxSort(sortParam) : undefined;
  const shown = (rarity ? inTab.filter((it) => it.card_templates.rarity === rarity) : inTab)
    .slice()
    .sort((a, b) => (sort ? compareTemplates(a.card_templates, b.card_templates, sort) : 0));

  const href = (over: { tab?: string; rarity?: string; sort?: string | null }) => {
    const nextTab = over.tab ?? tab.key;
    const sameTab = nextTab === tab.key;
    const q = new URLSearchParams({ tab: nextTab });
    if (over.rarity) q.set("rarity", over.rarity);
    const nextSort = over.sort === null ? undefined : over.sort ?? (sameTab ? sort : undefined);
    if (nextSort) q.set("sort", nextSort);
    return `/shop?${q.toString()}`;
  };
  const count = (r: Rarity) => inTab.filter((it) => it.card_templates.rarity === r).length;
  const sorts = tab.category === "moteur" ? ENGINE_SORTS : tab.category === "boite" ? GEARBOX_SORTS : null;

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-bold">Magasin de pièces neuves</h1>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Type</span>
        <nav className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-zinc-800 bg-[#10131a] p-1" aria-label="Type de pièce">
          {TABS.map((t) => {
            const on = t.key === tab.key;
            const n = items.filter((it) => it.card_templates.category === t.category).length;
            return (
              <Link key={t.key} href={href({ tab: t.key })} scroll={false} aria-current={on ? "true" : undefined} className={seg(on)}>
                <t.icon size={15} strokeWidth={2} />
                {t.label}
                <span className={on ? "tabular-nums text-black/60" : "tabular-nums text-zinc-500"}>{n}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {hasRarity && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Niveau</span>
          <nav className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-zinc-800 bg-[#10131a] p-1" aria-label="Filtrer par rareté">
            <Link href={href({})} scroll={false} aria-current={!rarity ? "true" : undefined} className={seg(!rarity)}>
              Tous
            </Link>
            {RARITIES.filter((r) => count(r) > 0 || r === rarity).map((r) => {
              const on = r === rarity;
              return (
                <Link key={r} href={href({ rarity: r })} scroll={false} aria-current={on ? "true" : undefined} className={seg(on)}>
                  <span className={`h-2 w-2 shrink-0 rounded-full ${on ? "bg-black/40" : RARITY_DOT[r]}`} />
                  {RARITY_LABEL[r]}
                  <span className={on ? "tabular-nums text-black/60" : "tabular-nums text-zinc-500"}>{count(r)}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      )}

      {sorts && (
        <SortLinks
          label="Trier"
          options={sorts}
          current={sort}
          hrefFor={(key) => href({ sort: key })}
        />
      )}

      {shown.length === 0 ? (
        <p className="text-sm text-zinc-400">Aucune pièce dans cette sélection pour le moment.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {shown.map((it) => (
            <CardView key={it.id} template={it.card_templates} tirePerfs={tirePerfs}>
              <p className="mb-2 text-sm">
                {it.price} 🪙 {it.stock !== null && <span className="text-zinc-500">· stock {it.stock}</span>}
              </p>
              <ActionForm
                action={buyShopItem}
                submitLabel="Acheter"
                confirmText={`Acheter ${it.card_templates.name} pour ${it.price} pièces ?`}
                className="flex flex-wrap gap-2"
              >
                <input type="hidden" name="catalog_id" value={it.id} />
              </ActionForm>
            </CardView>
          ))}
        </div>
      )}
    </section>
  );
}
