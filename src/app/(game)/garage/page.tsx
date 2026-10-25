import Link from "next/link";
import { BookOpen, Gift, LayoutGrid, Wrench } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { WelcomeDraw } from "@/components/WelcomeDraw";
import { parisToday, parisWeekStart } from "@/lib/format";
import { toDrawn } from "@/lib/reveal";
import { loadGaragePage } from "@/lib/queries";
import type { UserCard } from "@/lib/types";

export const metadata = { title: "Garage — CarsDuel" };

const ORDER = { moteur: 0, boite: 1, bonus: 2, pneus: 3 } as const;

const TILES = [
  { href: "/garage/tirages", title: "Mes tirages gratuits", text: "Le quotidien, l'hebdomadaire et l'historique.", icon: Gift },
  { href: "/garage/inventaire", title: "Mon inventaire", text: "Moteurs, boîtes, pneus et bonus.", icon: LayoutGrid },
  { href: "/garage/casse", title: "Musée de la casse", text: "Les pièces détruites, à recycler.", icon: Wrench },
  { href: "/garage/regles", title: "Règles du jeu", text: "Comment se déroule une course.", icon: BookOpen },
];

export default async function GaragePage({ searchParams }: { searchParams: Promise<{ bienvenue?: string }> }) {
  const { bienvenue } = await searchParams;
  const { user } = await requireUser();
  const dailyReady = user.last_daily_pull !== parisToday();
  const weeklyReady = user.last_weekly_pull !== parisWeekStart();
  const { cards } = bienvenue === "1" ? await loadGaragePage(user.id) : { cards: [] as UserCard[] };

  const welcome =
    bienvenue === "1"
      ? (cards as (UserCard & { source?: string })[])
          .filter((c) => c.source === "starter" && !c.is_destroyed)
          .sort((a, b) => ORDER[a.card_templates.category] - ORDER[b.card_templates.category])
          .map((c) => toDrawn(c.id, c.card_templates))
      : [];

  return (
    <>
      <div>
        <h1 className="font-display text-3xl font-bold uppercase">Bienvenue dans votre garage {user.username}</h1>
        <p className="text-zinc-400">Choisissez une pièce du garage.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {TILES.map(({ href, title, text, icon: Icon }) => (
          <Link key={href} href={href} className="group rounded-2xl border border-zinc-800 bg-[#10131a] p-5 transition-colors hover:border-amber-500/70">
            <Icon className="text-amber-400" size={28} strokeWidth={1.6} />
            <h2 className="mt-3 font-display text-2xl font-bold uppercase group-hover:text-amber-300">{title}</h2>
            <p className="mt-1 text-sm text-zinc-400">{text}</p>
            {href === "/garage/tirages" && (
              <p className={`mt-3 text-sm font-semibold ${dailyReady || weeklyReady ? "text-emerald-400" : "text-zinc-500"}`}>
                {dailyReady || weeklyReady ? "Un tirage est disponible" : "Prochains tirages plus tard"}
              </p>
            )}
          </Link>
        ))}
      </div>
      {welcome.length > 0 && <WelcomeDraw cards={welcome} />}
    </>
  );
}
