"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { RANKS, rankProgress, rankRange } from "@/lib/game";

const xp = (n: number) => n.toLocaleString("fr-FR");

export function ProfileMenu({
  username,
  xpWeek,
  xpMonth,
  signOut,
}: {
  username: string;
  xpWeek: number;
  xpMonth: number;
  signOut: () => Promise<void>;
}) {
  const pathname = usePathname();
  const details = useRef<HTMLDetailsElement>(null);
  const progress = rankProgress(xpMonth);
  const { rank, next } = progress;

  useEffect(() => {
    if (details.current) details.current.open = false;
  }, [pathname]);

  return (
    <details ref={details} className="relative">
      <summary
        aria-label={`Profil de ${username}`}
        title={username}
        className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 font-display text-lg font-bold uppercase md:h-10 md:w-10 [&::-webkit-details-marker]:hidden"
      >
        {username.slice(0, 1)}
      </summary>
      <div className="absolute right-0 z-40 mt-2 max-h-[min(32rem,calc(100vh-5rem))] w-80 max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-sm shadow-xl">
        <p className="font-display text-xs font-semibold uppercase tracking-wider text-zinc-500">Profil</p>
        <p className="truncate font-display text-lg font-bold">{username}</p>

        <div className={`mt-3 rounded-lg border border-zinc-800 px-3 py-2.5 ${rank.row}`}>
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${rank.dot}`} />
            <p className={`font-display text-xs font-semibold uppercase tracking-wider ${rank.text}`}>{rank.tier}</p>
          </div>
          <p className="mt-0.5 font-display text-xl font-bold leading-tight">{rank.name}</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/40">
            <div className={`h-full rounded-full ${rank.bar}`} style={{ width: `${progress.pct}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-zinc-400">
            {next ? `${xp(progress.remaining)} XP pour ${next.name}` : "Rang maximum ce mois"}
          </p>
        </div>

        <dl className="mt-3 space-y-2 rounded-lg border border-zinc-800 px-3 py-2">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-zinc-400">Mes XP de la semaine</dt>
            <dd className="font-display text-lg font-bold tabular-nums text-amber-400">{xp(xpWeek)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-zinc-400">Mes XP du mois</dt>
            <dd className="font-display text-lg font-bold tabular-nums text-amber-400">{xp(xpMonth)}</dd>
          </div>
        </dl>

        <form action={signOut} className="mt-3">
          <button className="min-h-10 w-full rounded px-2 py-1 text-left text-zinc-300 hover:bg-zinc-800">Déconnexion</button>
        </form>

        <p className="mb-1.5 mt-3 font-display text-xs font-semibold uppercase tracking-wider text-zinc-500">Rangs du mois</p>
        <ul className="space-y-1">
          {RANKS.map((row) => {
            const current = row.id === rank.id;
            return (
              <li key={row.id} className={`rounded-md px-2 py-1 ${current ? row.row : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${row.dot}`} />
                    <span className={`font-display text-xs font-semibold uppercase ${row.text}`}>{row.tier}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-xs text-zinc-500">{rankRange(row)} XP</span>
                </div>
                <p className={`pl-4 ${current ? "text-white" : "text-zinc-300"}`}>{row.name}</p>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs leading-snug text-zinc-500">
          Le rang suit l&apos;XP du mois. Il revient à Rookie au changement de mois.
        </p>
      </div>
    </details>
  );
}
