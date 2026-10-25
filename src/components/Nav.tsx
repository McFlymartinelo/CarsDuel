"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Coins, House, ShoppingBag, Swords, Tag } from "lucide-react";
import { Logo } from "@/components/Logo";
import { NotificationBell } from "@/components/NotificationBell";
import { ProfileMenu } from "@/components/ProfileMenu";
import type { NotificationFeed } from "@/lib/types";

const LINKS = [
  { href: "/garage", label: "Garage" },
  { href: "/duel", label: "Jouer" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/shop", label: "Boutique" },
  { href: "/leaderboard", label: "Leaderboard" },
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
              <b className="text-lg tabular-nums">{coins.toLocaleString("fr-FR")}</b>
            </span>
            <Link
              href="/garage/tirages"
              className="rounded-lg border border-zinc-700 px-3 py-1 text-center font-display uppercase leading-tight hover:bg-zinc-800"
            >
              <span className="block text-sm font-semibold">Tirages</span>
              <span className={`text-xs ${pullsAvailable ? "text-emerald-400" : "text-zinc-500"}`}>
                {pullsAvailable ? "Dispo ●" : "Déjà fait"}
              </span>
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
        <div className="flex items-center gap-2 px-3 py-2">
          <Link href="/garage" className="flex shrink-0 items-center gap-2 font-display text-xl font-bold uppercase leading-[0.85]">
            <Logo size={36} />
            <span>
              Cars<br />
              <span className="text-zinc-500">Duel</span>
            </span>
          </Link>
          <span className="ml-auto inline-flex items-center gap-1 rounded-lg border border-zinc-700 px-2 py-1 font-display text-amber-400" title="Pièces">
            <Coins size={14} strokeWidth={2.25} />
            <b className="text-sm tabular-nums">{coins.toLocaleString("fr-FR")}</b>
          </span>
          <Link
            href="/garage/tirages"
            className="flex min-h-11 min-w-16 flex-col items-center justify-center rounded-lg border border-zinc-700 px-3 font-display uppercase leading-tight"
          >
            <span className="text-[11px] font-bold tracking-wide">Tirages</span>
            <span className={`text-xs ${pullsAvailable ? "text-emerald-400" : "text-zinc-500"}`}>
              {pullsAvailable ? "Dispo ●" : "Déjà fait"}
            </span>
          </Link>
          {bell}
          {profileMenu}
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
