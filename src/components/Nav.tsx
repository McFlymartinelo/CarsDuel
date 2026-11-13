"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Boxes, Coins, Gift, House, ShoppingBag, Swords, Tag } from "lucide-react";
import { Logo } from "@/components/Logo";
import { NotificationBell } from "@/components/NotificationBell";
import { ProfileMenu } from "@/components/ProfileMenu";
import { formatWalletCoins } from "@/lib/format";
import { APP_WIDTH } from "@/lib/layout";
import type { NotificationFeed } from "@/lib/types";

const LINKS = [
  { href: "/garage", label: "Garage" },
  { href: "/duel", label: "Jouer" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/shop", label: "Boutique" },
  { href: "/leaderboard", label: "Classement" },
];

const MOBILE_LEFT = [
  { href: "/garage", label: "Garage", icon: House },
  { href: "/marketplace", label: "Marché", icon: Tag },
];

const MOBILE_RIGHT = [
  { href: "/shop", label: "Boutique", icon: ShoppingBag },
  { href: "/leaderboard", label: "Classement", icon: BarChart3 },
];

export function Nav({
  username,
  coins,
  scrapCubes,
  xpWeek,
  xpMonth,
  pullsAvailable,
  notifications,
  signOut,
}: {
  username: string;
  coins: number;
  scrapCubes: number;
  xpWeek: number;
  xpMonth: number;
  pullsAvailable: boolean;
  notifications: NotificationFeed;
  signOut: () => Promise<void>;
}) {
  const pathname = usePathname();
  const bell = <NotificationBell feed={notifications} />;

  const profileMenu = <ProfileMenu username={username} xpWeek={xpWeek} xpMonth={xpMonth} signOut={signOut} />;

  return (
    <>
      {/* ---------- PC / tablette : en-tête complet + onglets ---------- */}
      <header className="hidden border-b border-line bg-header md:block">
        <div className={`${APP_WIDTH} flex flex-wrap items-center gap-x-8 gap-y-3 px-6 py-3 2xl:px-10`}>
          <Link href="/garage" className="flex items-center gap-3 font-display text-3xl font-bold uppercase leading-none tracking-wide">
            <Logo size={48} />
            <span className="whitespace-nowrap">
              Cars<span className="text-zinc-500">Duel</span>
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-2.5 py-1 font-display text-amber-400" title="Pièces">
              <Coins size={16} strokeWidth={2.25} />
              <b className="text-lg tabular-nums">{formatWalletCoins(coins)}</b>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-2.5 py-1 font-display text-zinc-200" title="Cubes de ferraille">
              <Boxes size={16} strokeWidth={2.1} className="text-orange-300" />
              <b className="text-lg tabular-nums">{scrapCubes.toLocaleString("fr-FR")}</b>
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Cubes</span>
            </span>
            <Link
              href="/garage/tirages"
              className="relative inline-flex h-10 items-center gap-2 rounded-lg border border-line-strong px-3 font-display uppercase leading-tight hover:bg-zinc-800"
            >
              <Gift size={18} strokeWidth={1.9} className="shrink-0 text-zinc-200" />
              <span className="flex flex-col items-start">
                <span className="text-sm font-semibold">Tirages</span>
                <span className={`text-xs normal-case ${pullsAvailable ? "text-emerald-400" : "text-zinc-400"}`}>
                  {pullsAvailable ? "Dispo" : "Déjà fait"}
                </span>
              </span>
              <span aria-hidden className={`absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-[#0d1015] ${pullsAvailable ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.55)]" : "bg-zinc-500"}`} />
            </Link>
            {bell}
            {profileMenu}
          </div>
        </div>

        <nav aria-label="Navigation principale" className="border-t border-line/80 bg-[#0b0e13]">
          <div className={`${APP_WIDTH} flex justify-center gap-1 px-6 2xl:px-10`}>
            {LINKS.map(({ href, label }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`border-b-2 px-5 py-2.5 font-display text-sm font-semibold uppercase tracking-wider ${
                    active ? "border-amber-500 text-amber-400" : "border-transparent text-zinc-400 hover:text-white"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      {/* ---------- Mobile : logo, pièces, tirages ---------- */}
      <header className="sticky top-0 z-40 border-b border-line bg-header/95 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden">
        <div className="flex items-center gap-1 px-1.5 py-1.5 min-[380px]:gap-1.5 min-[380px]:px-3">
          <Link href="/garage" className="flex shrink-0 items-center gap-1 font-display text-lg font-bold uppercase leading-none min-[380px]:gap-2 min-[380px]:text-2xl">
            <Logo size={32} />
            <span className="whitespace-nowrap">
              Cars<span className="text-zinc-500">Duel</span>
            </span>
          </Link>
          <div className="ml-auto flex shrink-0 items-center gap-1 min-[380px]:gap-1.5">
            <span className="inline-flex h-10 shrink-0 items-center gap-1 rounded-xl border border-line-strong bg-panel px-1.5 font-display min-[380px]:gap-1.5" title="Pièces et cubes de ferraille">
              <span className="inline-flex items-center gap-1 text-amber-400" title="Pièces" aria-label={`${coins.toLocaleString("fr-FR")} pièces`}>
                <Coins size={13} strokeWidth={2.25} className="shrink-0 min-[380px]:h-4 min-[380px]:w-4" />
                <b className="text-[10px] tabular-nums min-[380px]:text-xs">{coins.toLocaleString("fr-FR")}</b>
              </span>
              <span aria-hidden className="h-4 w-px bg-zinc-700" />
              <span className="inline-flex items-center gap-1 text-zinc-200" title="Cubes de ferraille" aria-label={`${scrapCubes.toLocaleString("fr-FR")} cubes de ferraille`}>
                <Boxes size={13} strokeWidth={2.1} className="shrink-0 text-orange-300 min-[380px]:h-4 min-[380px]:w-4" />
                <b className="text-[10px] tabular-nums min-[380px]:text-xs">{scrapCubes.toLocaleString("fr-FR")}</b>
              </span>
            </span>
            {bell}
            {profileMenu}
          </div>
        </div>
      </header>

      {/* ---------- Mobile : barre d'onglets du bas (zone du pouce) ---------- */}
      <nav aria-label="Navigation mobile" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-header/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="grid grid-cols-5 items-end">
          {MOBILE_LEFT.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 border-t-2 px-0.5 text-center text-[11px] font-semibold leading-tight ${
                  active ? "border-amber-500 text-amber-400" : "border-transparent text-zinc-400"
                }`}
              >
                <Icon size={22} strokeWidth={1.8} />
                {label}
              </Link>
            );
          })}

          <Link
            href="/duel"
            aria-current={pathname.startsWith("/duel") ? "page" : undefined}
            className="flex flex-col items-center justify-end gap-0.5 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-wide text-amber-300"
          >
            <span
              className={`-mt-7 grid h-14 w-14 place-items-center rounded-full border border-amber-200/60 bg-gradient-to-b from-amber-300 to-amber-500 text-black shadow-[0_10px_26px_-8px_rgba(245,158,11,0.85),0_0_0_5px_#0d1015,0_0_0_6px_rgba(245,158,11,0.35)] transition ${
                pathname.startsWith("/duel") ? "brightness-110" : "brightness-95"
              }`}
            >
              <Swords size={24} strokeWidth={1.9} />
            </span>
            Jouer
          </Link>

          {MOBILE_RIGHT.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 border-t-2 px-0.5 text-center text-[11px] font-semibold leading-tight ${
                  active ? "border-amber-500 text-amber-400" : "border-transparent text-zinc-400"
                }`}
              >
                <Icon size={22} strokeWidth={1.8} />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
