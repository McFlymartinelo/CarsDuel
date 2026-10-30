import { existsSync } from "node:fs";
import path from "node:path";
import { Clock3 } from "lucide-react";
import { GarageTile } from "@/components/GarageTile";
import { requireUser } from "@/lib/auth";
import { WelcomeDraw } from "@/components/WelcomeDraw";
import { parisToday, parisWeekStart } from "@/lib/format";
import { toDrawn } from "@/lib/reveal";
import { loadGaragePage } from "@/lib/queries";
import type { UserCard } from "@/lib/types";

export const metadata = { title: "Garage — CarsDuel" };

const ORDER = { moteur: 0, boite: 1, bonus: 2, pneus: 3 } as const;

const VITRINE_IMAGE = "/garage/vitrine.webp";
const hasVitrineImage = existsSync(path.join(process.cwd(), "public", VITRINE_IMAGE));

const TILES: { href: string; title: string; text: string; image?: string; imageFit?: "cover" | "contain" }[] = [
  { href: "/garage/tirages", title: "Mes tirages gratuits", text: "Le quotidien, l'hebdomadaire et l'historique.", image: "/garage/tirages.webp" },
  { href: "/garage/trophees", title: "Ma vitrine de trophées", text: "Vos victoires, vos titres et vos médailles.", image: hasVitrineImage ? VITRINE_IMAGE : undefined, imageFit: "contain" },
  { href: "/garage/inventaire", title: "Mon inventaire", text: "Moteurs, boîtes, pneus et bonus.", image: "/garage/inventaire.webp" },
  { href: "/garage/collection", title: "Le coin du collectionneur", text: "Toutes les cartes du jeu et votre progression.", image: "/garage/collectionneur.png", imageFit: "contain" },
  { href: "/garage/casse", title: "Musée de la casse", text: "Les pièces détruites, à recycler.", image: "/garage/casse.webp" },
  { href: "/garage/regles", title: "Règles du jeu", text: "Comment se déroule une course.", image: "/garage/regles.webp" },
];

export default async function GaragePage({ searchParams }: { searchParams: Promise<{ bienvenue?: string }> }) {
  const { bienvenue } = await searchParams;
  const { user } = await requireUser();
  const dailyReady = user.last_daily_pull !== parisToday();
  const weeklyReady = user.last_weekly_pull !== parisWeekStart();
  const drawReady = dailyReady || weeklyReady;
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
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {TILES.map(({ href, title, text, image, imageFit }) => (
          <GarageTile
            key={href}
            href={href}
            title={title}
            text={text}
            image={image}
            imageFit={imageFit}
            badge={
              href === "/garage/tirages" ? (
                <span className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${drawReady ? "border-emerald-400/30 bg-emerald-950/65 text-emerald-300" : "border-zinc-500/30 bg-black/50 text-zinc-300"}`}>
                  <Clock3 size={14} className={drawReady ? "text-emerald-400" : "text-zinc-400"} />
                  {drawReady ? "Un tirage est disponible" : "Prochains tirages plus tard"}
                </span>
              ) : undefined
            }
          />
        ))}
      </div>
      {welcome.length > 0 && <WelcomeDraw cards={welcome} />}
    </>
  );
}
