import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { QuestPing } from "@/components/QuestPing";
import { getLeaderboard } from "@/lib/queries";

export const metadata = { title: "Classement — CarsDuel" };

const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", ...opts }).format(new Date(iso));

const PRIZES = {
  weekly: [
    ["1er", "50 pièces"],
    ["2e", "40 pièces"],
    ["3e", "30 pièces"],
    ["Top 5 % hors podium", "10 pièces"],
  ],
  monthly: [
    ["1er", "250 pièces"],
    ["2e", "200 pièces"],
    ["3e", "150 pièces"],
    ["Top 5 % hors podium", "50 pièces"],
  ],
} as const;

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period } = await searchParams;
  const monthly = period === "monthly";
  const key = monthly ? "monthly" : "weekly";
  const { user } = await requireUser();
  const rows = await getLeaderboard(user.id, key);
  // period_end est exclusif (00:00 du jour suivant) : on affiche la veille comme dernier jour.
  const last = rows[0] ? new Date(new Date(rows[0].period_end).getTime() - 1).toISOString() : null;
  const players = rows[0]?.player_count ?? 0;

  const tab = (active: boolean) =>
    `rounded px-3 py-1.5 text-sm ${active ? "bg-amber-500 font-semibold text-black" : "border border-zinc-700 text-zinc-300 hover:bg-zinc-800"}`;

  return (
    <section className="space-y-4">
      <QuestPing quest="leaderboard" />
      <h1 className="font-display text-2xl font-bold uppercase">Classement XP</h1>
      <div className="flex gap-2">
        <Link href="/leaderboard?period=weekly" className={tab(!monthly)}>Hebdomadaire</Link>
        <Link href="/leaderboard?period=monthly" className={tab(monthly)}>Mensuel</Link>
      </div>
      {rows[0] && last && (
        <p className="text-sm text-zinc-500">
          Du {fmt(rows[0].period_start, { dateStyle: "long" })} au {fmt(last, { dateStyle: "long" })} (heure de Paris)
          {players > 0 && ` · ${players.toLocaleString("fr-FR")} pilote${players > 1 ? "s" : ""}`}
        </p>
      )}

      <div className="max-w-xl rounded-xl border border-zinc-800 bg-[#0e1117] p-3">
        <p className="font-display text-sm font-semibold uppercase tracking-wide text-zinc-300">
          Primes {monthly ? "du mois" : "de la semaine"}
        </p>
        <ul className="mt-2 space-y-1">
          {PRIZES[key].map(([place, reward]) => (
            <li key={place} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-zinc-400">{place}</span>
              <span className="font-display font-semibold text-amber-400">{reward}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs leading-snug text-zinc-500">
          Montants de base, multipliés par le coefficient de rang du pilote (×1 à ×3) selon son XP du mois.
          Versées à la clôture : lundi 00:00 pour la semaine, le 1er à 00:00 pour le mois (heure de Paris).
          Le top 5 % compte le peloton classé, podium exclu.
        </p>
      </div>

      <div className="max-w-xl overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-zinc-500">
            <tr>
              <th className="py-1">#</th>
              <th>Pilote</th>
              <th className="text-right">XP</th>
              <th className="text-right">Prime</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.user_id} className={`border-t border-zinc-800 ${r.user_id === user.id ? "bg-amber-500/10 font-semibold" : ""}`}>
                <td className={`py-1.5 tabular-nums ${r.rank <= 3 ? "text-amber-300" : ""}`}>{r.rank}</td>
                <td>{r.username}</td>
                <td className="text-right tabular-nums">{r.xp.toLocaleString("fr-FR")}</td>
                <td className="text-right tabular-nums text-amber-400">{r.prize > 0 ? r.prize.toLocaleString("fr-FR") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <p className="text-sm text-zinc-500">Aucun point d&apos;XP sur cette période.</p>}
    </section>
  );
}
