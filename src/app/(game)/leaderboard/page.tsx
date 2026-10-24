import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getLeaderboard } from "@/lib/queries";

export const metadata = { title: "Classement — CarsDuel" };


const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", ...opts }).format(new Date(iso));

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period } = await searchParams;
  const monthly = period === "monthly";
  const { user } = await requireUser();
  const rows = await getLeaderboard(user.id, monthly ? "monthly" : "weekly");
  // period_end est exclusif (00:00 du jour suivant) : on affiche la veille comme dernier jour.
  const last = rows[0] ? new Date(new Date(rows[0].period_end).getTime() - 1).toISOString() : null;

  const tab = (active: boolean) =>
    `rounded px-3 py-1.5 text-sm ${active ? "bg-amber-500 font-semibold text-black" : "border border-zinc-700 text-zinc-300 hover:bg-zinc-800"}`;

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-bold">Classement XP</h1>
      <div className="flex gap-2">
        <Link href="/leaderboard?period=weekly" className={tab(!monthly)}>Hebdomadaire</Link>
        <Link href="/leaderboard?period=monthly" className={tab(monthly)}>Mensuel</Link>
      </div>
      {rows[0] && last && (
        <p className="text-sm text-zinc-500">
          Du {fmt(rows[0].period_start, { dateStyle: "long" })} au {fmt(last, { dateStyle: "long" })} (heure de Paris)
        </p>
      )}
      <table className="w-full max-w-xl text-left text-sm">
        <thead className="text-zinc-500">
          <tr><th className="py-1">#</th><th>Pilote</th><th className="text-right">XP</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.user_id} className={`border-t border-zinc-800 ${r.user_id === user.id ? "bg-amber-500/10 font-semibold" : ""}`}>
              <td className="py-1.5">{r.rank}</td>
              <td>{r.username}</td>
              <td className="text-right">{r.xp}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="text-sm text-zinc-500">Aucun point d&apos;XP sur cette période.</p>}
    </section>
  );
}
