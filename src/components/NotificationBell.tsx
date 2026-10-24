"use client";

import { useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Check, Coins, ShieldCheck, Swords, Tag, Trophy, X, type LucideIcon } from "lucide-react";
import { markNotificationsSeen } from "@/app/(game)/notifications";
import { formatDateTime } from "@/lib/format";
import type { NotificationFeed, NotificationItem, NotificationKind } from "@/lib/types";

const coins = (n: number) => `${n.toLocaleString("fr-FR")} 🪙`;

const KINDS: Record<NotificationKind, { icon: LucideIcon; tone: string; href: string; text: (i: NotificationItem) => string }> = {
  offer_received: { icon: Tag, tone: "text-amber-300", href: "/marketplace", text: (i) => `Offre de ${coins(i.amount)} sur ${i.label}` },
  sale: { icon: Coins, tone: "text-emerald-400", href: "/marketplace", text: (i) => `${i.label} vendu : +${coins(i.amount)}` },
  offer_accepted: { icon: Check, tone: "text-emerald-400", href: "/garage", text: (i) => `Offre acceptée sur ${i.label} (${coins(i.amount)})` },
  offer_rejected: { icon: X, tone: "text-red-400", href: "/marketplace", text: (i) => `Offre refusée sur ${i.label} : ${coins(i.amount)} remboursées` },
  duel_won: { icon: ShieldCheck, tone: "text-emerald-400", href: "/duel", text: (i) => `Vous avez repoussé ${i.label}${i.amount > 0 ? ` : +${coins(i.amount)}` : ""}` },
  duel_lost: { icon: Swords, tone: "text-red-400", href: "/duel", text: (i) => `${i.label} a battu votre configuration` },
  payout: { icon: Trophy, tone: "text-amber-300", href: "/leaderboard", text: (i) => `${i.label} : +${coins(i.amount)}` },
};

/** Cloche du Nav. Le badge compte les événements postérieurs à la dernière fermeture du panneau. */
export function NotificationBell({ feed }: { feed: NotificationFeed }) {
  const pathname = usePathname();
  const details = useRef<HTMLDetailsElement>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (details.current) details.current.open = false;
  }, [pathname]);

  function onToggle(e: React.SyntheticEvent<HTMLDetailsElement>) {
    // Lu à la fermeture : pendant la lecture, les nouveautés restent en évidence.
    if (!e.currentTarget.open && feed.unread > 0) startTransition(() => void markNotificationsSeen());
  }

  return (
    <details ref={details} onToggle={onToggle} className="relative">
      <summary
        aria-label={feed.unread > 0 ? `Notifications : ${feed.unread} nouvelle(s)` : "Notifications"}
        className="relative flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 md:h-10 md:w-10 [&::-webkit-details-marker]:hidden"
      >
        <Bell size={20} strokeWidth={1.8} />
        {feed.unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[11px] font-bold leading-none text-black tabular-nums">
            {feed.unread > 9 ? "9+" : feed.unread}
          </span>
        )}
      </summary>
      <div className="absolute right-0 z-40 mt-2 max-h-[min(30rem,calc(100vh-6rem))] w-80 max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 p-2 text-sm shadow-xl">
        <p className="px-2 pb-1 pt-1 font-display text-xs font-semibold uppercase tracking-wider text-zinc-500">Notifications</p>
        {feed.items.length === 0 && <p className="px-2 py-3 text-zinc-500">Rien de neuf pour l&apos;instant.</p>}
        <ul>
          {feed.items.map((i, n) => {
            const k = KINDS[i.kind];
            return (
              <li key={`${i.kind}-${i.at}-${n}`}>
                <Link href={k.href} className={`flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-zinc-800 ${i.unread ? "bg-amber-500/5" : ""}`}>
                  <k.icon size={18} strokeWidth={1.8} className={`mt-0.5 shrink-0 ${k.tone}`} />
                  <span className="min-w-0 flex-1">
                    <span className={`block leading-snug ${i.unread ? "text-white" : "text-zinc-300"}`}>{k.text(i)}</span>
                    <span className="text-xs text-zinc-500">{formatDateTime(i.at)}</span>
                  </span>
                  {i.unread && <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
}
