import { existsSync } from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, Boxes, Clock3, Gift, Layers, PackageOpen, Recycle, Swords, Trophy } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/lib/auth";
import { WelcomeDraw } from "@/components/WelcomeDraw";
import { GarageTile } from "@/components/GarageTile";
import { GarageQuickTile } from "@/components/garage/GarageQuickTile";
import { GarageViewToggle } from "@/components/garage/GarageViewToggle";
import { buttonClass } from "@/components/ui/Button";
import { GARAGE_VIEW_COOKIE, parseGarageView } from "@/lib/garage-view";
import { parisToday, parisWeekStart } from "@/lib/format";
import { toDrawn } from "@/lib/reveal";
import { loadGaragePage } from "@/lib/queries";
import type { UserCard } from "@/lib/types";

export const metadata = { title: "Garage — CarsDuel" };

const ORDER = { moteur: 0, boite: 1, bonus: 2, pneus: 3 } as const;

const VITRINE_IMAGE = "/garage/vitrine.webp";
const hasVitrineImage = existsSync(path.join(process.cwd(), "public", VITRINE_IMAGE));

const TILES = [
  { href: "/garage/tirages", title: "Mes tirages gratuits", text: "Le quotidien, l'hebdomadaire et l'historique.", image: "/garage/tirages.webp", icon: PackageOpen },
  {
    href: "/garage/trophees",
    title: "Ma vitrine de trophées",
    text: "Vos victoires, vos titres et vos médailles.",
    image: hasVitrineImage ? VITRINE_IMAGE : undefined,
    imageFit: "contain" as const,
    icon: Trophy,
  },
  { href: "/garage/inventaire", title: "Mon inventaire", text: "Moteurs, boîtes, pneus et bonus.", image: "/garage/inventaire.webp", icon: Boxes },
  { href: "/garage/recyclage", title: "Centre de recyclage", text: "Compactez vos pièces en cubes de ferraille.", image: "/garage/recyclage.webp", icon: Recycle },
  {
    href: "/garage/collection",
    title: "Le coin du collectionneur",
    text: "Toutes les cartes du jeu et votre progression.",
    image: "/garage/collectionneur.png",
    imageFit: "contain" as const,
    icon: Layers,
  },
  { href: "/garage/regles", title: "Règles du jeu", text: "Comment se déroule une course.", image: "/garage/regles.webp", icon: BookOpen },
];

const pneuName = (name?: string) => name?.replace(/^Pneu /, "");

export default async function GaragePage({ searchParams }: { searchParams: Promise<{ bienvenue?: string }> }) {
  const { bienvenue } = await searchParams;
  const view = parseGarageView((await cookies()).get(GARAGE_VIEW_COOKIE)?.value);
  const { user } = await requireUser();

  const dailyReady = user.last_daily_pull !== parisToday();
  const weeklyReady = user.last_weekly_pull !== parisWeekStart();
  const pullCount = (dailyReady ? 1 : 0) + (weeklyReady ? 1 : 0);
  const drawReady = pullCount > 0;

  // Le mode simple n'a besoin d'aucune donnée de config : on ne charge
  // l'inventaire que pour le mode détaillé (ou le tirage de bienvenue).
  const garage = view === "detail" || bienvenue === "1" ? await loadGaragePage(user.id) : null;
  const cards = garage?.cards ?? [];
  const decks = garage?.decks ?? [];

  const config = decks[0];
  const byId = new Map(cards.map((c) => [c.id, c]));
  const engine = config?.engine_card_id ? byId.get(config.engine_card_id) : undefined;
  const gearbox = config?.gearbox_card_id ? byId.get(config.gearbox_card_id) : undefined;
  const tire = config?.tire_card_id ? byId.get(config.tire_card_id) : undefined;
  const usable = (card?: UserCard) => Boolean(card && !card.is_destroyed && !card.is_listed);
  const playable = Boolean(
    config && engine && gearbox && tire && usable(engine) && usable(gearbox) && usable(tire),
  );
  const inventoryCount = cards.filter(
    (c) => !c.in_recycle_bin && (!c.is_destroyed || c.card_templates.category !== "bonus"),
  ).length;
  const configLabel = [engine?.card_templates.name, gearbox?.card_templates.name, pneuName(tire?.card_templates.name)]
    .filter(Boolean)
    .join(" · ");

  const welcome =
    bienvenue === "1"
      ? (cards as (UserCard & { source?: string })[])
          .filter((c) => c.source === "starter" && !c.is_destroyed)
          .sort((a, b) => ORDER[a.card_templates.category] - ORDER[b.card_templates.category])
          .map((c) => toDrawn(c.id, c.card_templates))
      : [];

  const pullBadge = (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
        drawReady
          ? "border-emerald-400/40 bg-emerald-950/80 text-emerald-300"
          : "border-zinc-500/30 bg-black/50 text-zinc-300"
      }`}
    >
      <Clock3 size={12} className={drawReady ? "text-emerald-400" : "text-zinc-400"} />
      {drawReady ? (pullCount > 1 ? `${pullCount} dispo` : "1 dispo") : "Plus tard"}
    </span>
  );

  const quickTiles = [
    {
      href: "/garage/tirages",
      title: "Mes tirages",
      text: drawReady ? "Un tirage vous attend" : "Prochains tirages plus tard",
      image: "/garage/tirages.webp",
      icon: PackageOpen,
      badge: pullBadge,
    },
    {
      href: "/garage/inventaire",
      title: "Mon inventaire",
      text: `${inventoryCount} carte${inventoryCount > 1 ? "s" : ""}`,
      image: "/garage/inventaire.webp",
      icon: Boxes,
    },
    {
      href: "/garage/recyclage",
      title: "Recyclage",
      text: `${user.scrap_cubes.toLocaleString("fr-FR")} cube${user.scrap_cubes > 1 ? "s" : ""}`,
      image: "/garage/recyclage.webp",
      icon: Recycle,
    },
    {
      href: "/garage/trophees",
      title: "Ma vitrine",
      text: "Vos victoires et médailles",
      image: hasVitrineImage ? VITRINE_IMAGE : undefined,
      imageFit: "contain" as const,
      icon: Trophy,
    },
    {
      href: "/garage/collection",
      title: "Collection",
      text: "Toutes les cartes du jeu",
      image: "/garage/collectionneur.png",
      imageFit: "contain" as const,
      icon: Layers,
    },
    {
      href: "/garage/regles",
      title: "Règles",
      text: "Le guide du pilote",
      image: "/garage/regles.webp",
      icon: BookOpen,
    },
  ];

  const pullBanner = drawReady ? (
    <Link
      href="/garage/tirages"
      className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/15 to-panel p-3 transition hover:border-amber-400/60"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300">
        <Gift size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-sm font-bold uppercase text-white">
          {pullCount} tirage{pullCount > 1 ? "s" : ""} disponible{pullCount > 1 ? "s" : ""}
        </span>
        <span className="block text-[11px] text-zinc-400">
          {dailyReady ? "Quotidien" : ""}
          {dailyReady && weeklyReady ? " + " : ""}
          {weeklyReady ? "Hebdomadaire" : ""} · ouvrez pour découvrir vos cartes
        </span>
      </span>
      <span className={buttonClass({ size: "sm" })}>Ouvrir</span>
    </Link>
  ) : null;

  return (
    <>
      <PageHeader
        title={`Bienvenue dans votre garage ${user.username}`}
        actions={<GarageViewToggle view={view} />}
      />

      {view === "detail" ? (
        <>
          <section className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-panel p-4 shadow-[0_22px_50px_-34px_rgba(245,158,11,0.55)]">
            <Image
              src="/duel/hasard.webp"
              alt=""
              fill
              priority
              sizes="(min-width: 768px) 60vw, 100vw"
              className="object-cover object-right opacity-30 [mask-image:linear-gradient(to_left,#000_20%,transparent_90%)]"
            />
            <span aria-hidden className="absolute inset-0 bg-gradient-to-r from-panel via-panel/80 to-transparent" />
            <div className="relative z-10 space-y-3">
              <p className="font-display text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
                Prochaine action
              </p>
              <h2 className="font-display text-2xl font-bold uppercase leading-none text-white">
                {playable ? "Votre config est prête" : "Complétez votre config"}
              </h2>
              <p className="max-w-md text-sm text-zinc-400">
                {playable
                  ? "Moteur, boîte et pneus sont alignés : il ne reste qu'à lancer la course."
                  : "Il manque un moteur, une boîte ou des pneus disponibles dans votre garage."}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {playable ? (
                  <>
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                      Prêt à rouler
                    </span>
                    {engine && (
                      <span className="min-w-0 max-w-full truncate rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-xs text-zinc-300">
                        <b className="text-white">{engine.card_templates.name}</b>
                      </span>
                    )}
                    {gearbox && (
                      <span className="min-w-0 max-w-full truncate rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-xs text-zinc-300">
                        <b className="text-white">{gearbox.card_templates.name}</b>
                      </span>
                    )}
                    {tire && (
                      <span className="min-w-0 max-w-full truncate rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-xs text-zinc-300">
                        <b className="text-white">{pneuName(tire.card_templates.name)}</b>
                      </span>
                    )}
                  </>
                ) : (
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-200">
                    Config incomplète
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={playable ? "/duel" : "/duel?config=1"} className={buttonClass({ size: "md" })}>
                  {playable && <Swords size={16} aria-hidden />}
                  {playable ? "Lancer un duel" : "Compléter ma config"}
                </Link>
                <Link href="/duel?config=1" className={buttonClass({ variant: "ghost", size: "md" })}>
                  Modifier
                </Link>
              </div>
              {configLabel && <p className="text-[11px] text-zinc-500">{configLabel}</p>}
            </div>
          </section>

          {pullBanner}

          <div className="flex items-end justify-between gap-2">
            <h2 className="font-display text-xl font-bold uppercase">Mon garage</h2>
            <Link href="/duel?config=1" className="text-xs font-semibold text-amber-300">
              Modifier ma config
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {quickTiles.map(({ href, title, text, image, imageFit, icon, badge }) => (
              <GarageQuickTile
                key={href}
                href={href}
                title={title}
                text={text}
                image={image}
                imageFit={imageFit}
                icon={icon}
                badge={badge}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {TILES.map(({ href, title, text, image, imageFit, icon }) => (
            <GarageTile
              key={href}
              href={href}
              title={title}
              text={text}
              image={image}
              imageFit={imageFit}
              icon={icon}
              badge={
                href === "/garage/tirages" ? (
                  <span
                    className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                      drawReady
                        ? "border-emerald-400/30 bg-emerald-950/65 text-emerald-300"
                        : "border-zinc-500/30 bg-black/50 text-zinc-300"
                    }`}
                  >
                    <Clock3 size={14} className={drawReady ? "text-emerald-400" : "text-zinc-400"} />
                    {drawReady
                      ? pullCount > 1
                        ? `${pullCount} tirages disponibles`
                        : "Un tirage est disponible"
                      : "Prochains tirages plus tard"}
                  </span>
                ) : undefined
              }
            />
          ))}
        </div>
      )}

      {welcome.length > 0 && <WelcomeDraw cards={welcome} username={user.username} />}
    </>
  );
}
