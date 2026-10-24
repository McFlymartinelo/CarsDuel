"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { rankProgress } from "@/lib/game";

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
        <Link href="/compte" className="block truncate font-display text-lg font-bold hover:text-amber-300">{username}</Link>

        <div className={`mt-3 rounded-lg border border-zinc-800 px-3 py-2.5 ${rank.row}`}>
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${rank.dot}`} />
            <p className={`font-display text-xl font-bold leading-tight ${rank.text}`}>{rank.name}</p>
          </div>
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

        <Link href="/compte" className="mt-3 flex min-h-10 w-full items-center rounded px-2 py-1 text-zinc-300 hover:bg-zinc-800">
          Modifier le profil
        </Link>

        <form action={signOut}>
          <button className="min-h-10 w-full rounded px-2 py-1 text-left text-zinc-300 hover:bg-zinc-800">Déconnexion</button>
        </form>
      </div>
    </details>
  );
}
