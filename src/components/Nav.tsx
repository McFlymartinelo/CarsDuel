"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Coins, Gift, House, ShoppingBag, Swords, Tag } from "lucide-react";
import { Logo } from "@/components/Logo";
import { NotificationBell } from "@/components/NotificationBell";
import { ProfileMenu } from "@/components/ProfileMenu";
import { formatWalletCoins } from "@/lib/format";
import type { NotificationFeed } from "@/lib/types";

const LINKS = [
  { href: "/garage", label: "Garage" },
  { href: "/duel", label: "Jouer" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/shop", label: "Boutique" },
  { href: "/leaderboard", label: "Classement" },
];

const MOBILE_LINKS = [
  { href: "/garage", label: "Garage", icon: House },
  { href: "/duel", label: "Jouer", icon: Swords },
  { href: "/marketplace", label: "Marché", icon: Tag },
  { href: "/shop", label: "Boutique", icon: ShoppingBag },
  { href: "/leaderboard", label: "Classement", icon: BarChart3 },
];

export function Nav({
  username,
  coins,
  xpWeek,
  xpMonth,
  pullsAvailable,
  notifications,
  signOut,
}: {
  username: string;
  coins: number;
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
      <header className="hidden border-b border-zinc-800 bg-[#0d1015] md:block">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-x-8 gap-y-3 px-6 py-3 2xl:px-10">
          <Link href="/garage" className="flex items-center gap-3 font-display text-2xl font-bold uppercase leading-[0.85] tracking-wide">
            <Logo size={48} />
            <span>
              Cars<br />
              <span className="text-zinc-500">Duel</span>
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-2.5 py-1 font-display text-amber-400" title="Pièces">
              <Coins size={16} strokeWidth={2.25} />
              <b className="text-lg tabular-nums">{formatWalletCoins(coins)}</b>
            </span>
            <Link
              href="/garage/tirages"
              className="relative inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-700 px-3 font-display uppercase leading-tight hover:bg-zinc-800"
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

        <nav className="border-t border-zinc-800/80 bg-[#0b0e13]">
          <div className="mx-auto flex max-w-[1800px] justify-center gap-1 px-6 2xl:px-10">
            {LINKS.map(({ href, label }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
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
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-[#0d1015]/95 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden">
        <div className="flex items-center gap-1 px-1.5 py-1.5 min-[380px]:gap-1.5 min-[380px]:px-3">
          <Link href="/garage" className="flex shrink-0 items-center gap-1 font-display text-base font-bold uppercase leading-[0.85] min-[380px]:gap-2 min-[380px]:text-xl">
            <Logo size={32} />
            <span>
              Cars<br />
              <span className="text-zinc-500">Duel</span>
            </span>
          </Link>
          <div className="ml-auto flex shrink-0 items-center gap-1 min-[380px]:gap-1.5">
            <span className="inline-flex h-10 w-[4.5rem] shrink-0 items-center justify-center gap-1 rounded-xl border border-zinc-700 bg-[#10131a] px-1 font-display text-amber-400 min-[380px]:w-20 min-[380px]:gap-1.5" title="Pièces" aria-label={`${formatWalletCoins(coins)} pièces`}>
              <Coins size={13} strokeWidth={2.25} className="shrink-0 min-[380px]:h-4 min-[380px]:w-4" />
              <b className="truncate text-[10px] tabular-nums min-[380px]:text-xs">{formatWalletCoins(coins)}</b>
            </span>
            <Link
              href="/garage/tirages"
              aria-label={`Tirages : ${pullsAvailable ? "disponibles" : "déjà faits"}`}
              className="relative inline-flex h-10 w-[4.125rem] shrink-0 items-center justify-center gap-1 rounded-xl border border-zinc-700 bg-[#10131a] px-1 font-display uppercase leading-tight hover:bg-zinc-800 min-[380px]:w-[4.625rem] min-[380px]:gap-1.5"
            >
              <Gift size={13} strokeWidth={1.9} className="shrink-0 text-zinc-200 min-[380px]:h-4 min-[380px]:w-4" />
              <span className="flex min-w-0 flex-col items-start">
                <span className="text-[8px] font-bold tracking-wide min-[380px]:text-[9px]">Tirages</span>
                <span className={`whitespace-nowrap text-[8px] font-semibold normal-case ${pullsAvailable ? "text-emerald-400" : "text-zinc-400"}`}>
                  {pullsAvailable ? "Dispo" : "Déjà fait"}
                </span>
              </span>
              <span aria-hidden className={`absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-[#0d1015] ${pullsAvailable ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.55)]" : "bg-zinc-500"}`} />
            </Link>
            {bell}
            {profileMenu}
          </div>
        </div>
      </header>

      {/* ---------- Mobile : barre d'onglets du bas (zone du pouce) ---------- */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-800 bg-[#0d1015]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="grid grid-cols-5">
          {MOBILE_LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
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
