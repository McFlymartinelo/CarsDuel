"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, House, ShoppingBag, Swords, Tag } from "lucide-react";

const LINKS = [
  { href: "/garage", label: "Garage" },
  { href: "/duel", label: "Duels" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/shop", label: "Boutique" },
  { href: "/leaderboard", label: "Leaderboard" },
];

const MOBILE_LINKS = [
  { href: "/garage", label: "Garage", icon: House },
  { href: "/duel", label: "Duels", icon: Swords },
  { href: "/marketplace", label: "Marché", icon: Tag },
  { href: "/shop", label: "Boutique", icon: ShoppingBag },
  { href: "/leaderboard", label: "Rang", icon: BarChart3 },
];

export function Nav({
  username,
  coins,
  level,
  xpCurrent,
  xpNext,
  dailyAvailable,
  signOut,
}: {
  username: string;
  coins: number;
  level: number;
  xpCurrent: number;
  xpNext: number;
  dailyAvailable: boolean;
  signOut: () => Promise<void>;
}) {
  const pathname = usePathname();
  const pct = Math.min(100, Math.round((xpCurrent / xpNext) * 100));

  const profileMenu = (
    <details className="relative">
      <summary
        title={username}
        className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 font-display text-lg font-bold uppercase md:h-10 md:w-10"
      >
        {username.slice(0, 1)}
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-44 rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-sm shadow-lg">
        <p className="px-2 pb-1 text-zinc-400">{username}</p>
        <form action={signOut}>
          <button className="min-h-10 w-full rounded px-2 py-1 text-left text-zinc-300 hover:bg-zinc-800">Déconnexion</button>
        </form>
      </div>
    </details>
  );

  return (
    <>
      {/* ---------- PC / tablette : en-tête complet + onglets ---------- */}
      <header className="hidden border-b border-zinc-800 bg-[#0d1015] md:block">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-x-8 gap-y-3 px-6 py-3 2xl:px-10">
          <Link href="/garage" className="font-display text-2xl font-bold uppercase leading-[0.85] tracking-wide">
            Cars<br />
            <span className="text-zinc-500">Duel</span>
          </Link>

          <div className="flex flex-1 items-center gap-x-8 text-sm">
            <div className="flex max-w-xl flex-1 items-center gap-3 text-zinc-400">
              <span className="font-display uppercase">
                Niv. <b className="text-amber-400">{level}</b>
              </span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                <div className="h-full rounded-full bg-amber-500" style={{ width: `${pct}%` }} />
              </div>
              <span className="whitespace-nowrap tabular-nums">
                {xpCurrent} / {xpNext} XP
              </span>
            </div>
            <div className="font-display uppercase text-zinc-400">
              Pièces : <b className="text-lg text-amber-400 tabular-nums">{coins.toLocaleString("fr-FR")}</b>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/garage#tirage"
              className="rounded-lg border border-zinc-700 px-3 py-1 text-center font-display uppercase leading-tight hover:bg-zinc-800"
            >
              <span className="block text-sm font-semibold">Tirage quotidien</span>
              <span className={`text-xs ${dailyAvailable ? "text-emerald-400" : "text-zinc-500"}`}>
                {dailyAvailable ? "Dispo ●" : "Déjà fait"}
              </span>
            </Link>
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

      {/* ---------- Mobile : barre du haut (logo, tirage, pièces + niveau) ---------- */}
      <header className="sticky top-0 z-30 border-b border-zinc-800 bg-[#0d1015]/95 backdrop-blur md:hidden">
        <div className="flex items-center gap-2 px-3 pt-2">
          <Link href="/garage" className="font-display text-xl font-bold uppercase leading-[0.85]">
            Cars<br />
            <span className="text-zinc-500">Duel</span>
          </Link>
          <Link
            href="/garage#tirage"
            className="mx-auto rounded-lg border border-zinc-700 px-3 py-1 text-center font-display uppercase leading-tight"
          >
            <span className="block text-[11px] font-bold tracking-wide">Tirage quotidien</span>
            <span className={`text-xs ${dailyAvailable ? "text-emerald-400" : "text-zinc-500"}`}>
              {dailyAvailable ? "Dispo ●" : "Déjà fait"}
            </span>
          </Link>
          <span className="font-display text-sm uppercase text-zinc-400">
            Pièces <b className="text-base text-amber-400 tabular-nums">{coins.toLocaleString("fr-FR")}</b>
          </span>
          {profileMenu}
        </div>
        <div className="flex items-center gap-2 px-3 pb-2 pt-1.5 text-xs text-zinc-400">
          <span className="font-display uppercase">
            Niv. <b className="text-amber-400">{level}</b>
          </span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full rounded-full bg-amber-500" style={{ width: `${pct}%` }} />
          </div>
          <span className="whitespace-nowrap tabular-nums">{xpCurrent} / {xpNext} XP</span>
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
                className={`flex min-h-16 flex-col items-center justify-center gap-1 border-t-2 text-[11px] font-semibold ${
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
